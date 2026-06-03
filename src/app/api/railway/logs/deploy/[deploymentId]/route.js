export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../../../lib/session.js';
import { ensureInit } from '../../../../../../lib/setup.js';
import { User } from '../../../../../../models/User.js';
import { BonustimeUser } from '../../../../../../models/BonustimeUser.js';
import { config } from '../../../../../../config.js';
import { bonustimeTenantLookup, publicTenantKey, bonustimeSharedServiceName } from '../../../../../../services/bonustimeMultiTenant.js';

const RAILWAY_API_URLS = ['https://backboard.railway.app/graphql/v2', 'https://backbone.railway.app/graphql/v2'];

function railwayAuthHeader(token, mode) {
  if (mode === 'project') return { 'Project-Access-Token': token };
  return { Authorization: `Bearer ${token}` };
}

async function railwayQuery(query, variables = {}) {
  const token = String(config?.railway?.apiToken || '').trim();
  if (!token) throw new Error('Railway API token ยังไม่ได้ตั้งค่า');
  const preferred = String(config?.railway?.tokenType || '').trim().toLowerCase();
  const authModes = preferred === 'project' ? ['project', 'bearer'] : ['bearer', 'project'];
  const errors = [];

  for (const url of RAILWAY_API_URLS) {
    for (const mode of authModes) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...railwayAuthHeader(token, mode) },
          body: JSON.stringify({ query, variables }),
        });
        const text = await res.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
        if (res.ok && !data?.errors) return data;
        errors.push(`${mode}@${url}: HTTP ${res.status}`);
      } catch (err) {
        errors.push(`${mode}@${url}: ${err?.message}`);
      }
    }
  }
  throw new Error(`Railway API error: ${errors.slice(-2).join(' || ')}`);
}

async function fetchRailwayServices() {
  const projectId = config?.railway?.projectId;
  if (!projectId) throw new Error('Railway Project ID ยังไม่ได้ตั้งค่า');
  const result = await railwayQuery(`
    query GetProjectServices($projectId: String!) {
      project(id: $projectId) {
        services { edges { node { id name serviceInstances { edges { node { environmentId } } } deployments(first: 5) { edges { node { id status } } } } } }
      }
    }
  `, { projectId });
  return result.data?.project?.services?.edges?.map((e) => e.node).filter(Boolean) || [];
}

export async function GET(request, { params }) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const { deploymentId } = await params;
    if (!deploymentId) return NextResponse.json({ ok: false, message: 'Missing deploymentId' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || '';
    const isAdmin = session.user.role === 'admin';

    if (!isAdmin) {
      const services = await fetchRailwayServices();
      const sharedName = bonustimeSharedServiceName();
      const service = services.find((node) => {
        const name = String(node?.name || '').trim();
        const deps = node.deployments?.edges || [];
        if (deps.some((x) => String(x?.node?.id || '') === deploymentId)) return true;
        if (sharedName && name === sharedName) return true;
        return false;
      });

      if (!service) return NextResponse.json({ ok: false, message: 'ไม่พบ Service นี้ใน Railway' }, { status: 404 });

      const bt = tenantId ? await BonustimeUser.findOne(bonustimeTenantLookup(tenantId)).lean() : null;
      const user = await User.findById(session.user._id).select('serial_key');
      if (!user?.serial_key) return NextResponse.json({ ok: false, message: 'กรุณาลงทะเบียน Serial Key' }, { status: 403 });
      if (!bt || String(bt.serial_key || '').trim() !== user.serial_key.trim())
        return NextResponse.json({ ok: false, message: 'คุณไม่มีสิทธิ์ดู logs นี้' }, { status: 403 });
    }

    const bt = tenantId ? await BonustimeUser.findOne(bonustimeTenantLookup(tenantId)).lean() : null;
    const result = await railwayQuery(`
      query GetDeploymentLogs($deploymentId: String!) {
        deploymentLogs(deploymentId: $deploymentId, limit: 100) { message timestamp }
      }
    `, { deploymentId });

    const allLogs = result.data?.deploymentLogs || [];
    const key = publicTenantKey(bt || { tenantId });
    const legacyKey = String(bt?.legacyTenantId || bt?.tenantId || tenantId || '').trim();
    const acceptedKeys = [...new Set([key, legacyKey].filter(Boolean))];

    const markerRxList = [
      /\[(?:tenant|serviceKey|service|server)\s*:\s*([^\]\s]+)\]/i,
      /(?:tenantId|serviceKey|service|server)\s*[:=]\s*['"]?([a-z0-9_-]+)['"]?/i,
    ];

    const logs = allLogs.filter((l) => {
      const msg = String(l?.message || '');
      for (const rx of markerRxList) {
        const m = msg.match(rx);
        if (m && acceptedKeys.includes(String(m[1] || '').trim())) return true;
      }
      return false;
    });

    const response = NextResponse.json({
      ok: true, logs, tenantId: key, filtered: true,
      hiddenOtherTenantLogs: allLogs.length - logs.length,
      message: logs.length ? '' : 'ยังไม่มี log ของ Server นี้ใน deployment ล่าสุด',
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
