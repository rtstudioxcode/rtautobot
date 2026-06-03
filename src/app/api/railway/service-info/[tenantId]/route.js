export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/session.js';
import { ensureInit } from '../../../../../lib/setup.js';
import { User } from '../../../../../models/User.js';
import { BonustimeUser } from '../../../../../models/BonustimeUser.js';
import { config } from '../../../../../config.js';
import { bonustimeTenantLookup, publicTenantKey, bonustimeSharedServiceName } from '../../../../../services/bonustimeMultiTenant.js';

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
        const gqlErr = Array.isArray(data?.errors) ? data.errors.map((e) => e?.message).join(' | ') : '';
        errors.push(`${mode}@${url}: HTTP ${res.status} ${gqlErr || res.statusText}`);
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

    const { tenantId } = await params;
    if (!tenantId) return NextResponse.json({ ok: false, message: 'Missing tenantId' }, { status: 400 });

    const services = await fetchRailwayServices();
    const sharedName = bonustimeSharedServiceName();
    const isAdmin = session.user.role === 'admin';

    const service = services.find((node) => {
      const name = String(node?.name || '').trim();
      if (sharedName && name === sharedName) return true;
      if (!sharedName && name === tenantId) return true;
      return false;
    });

    if (!service) return NextResponse.json({ ok: false, message: 'ไม่พบ Service นี้ใน Railway' }, { status: 404 });

    const bt = await BonustimeUser.findOne(bonustimeTenantLookup(tenantId)).lean();

    if (!isAdmin) {
      const user = await User.findById(session.user._id).select('serial_key');
      if (!user?.serial_key) return NextResponse.json({ ok: false, message: 'กรุณาลงทะเบียน Serial Key' }, { status: 403 });
      if (!bt || String(bt.serial_key || '').trim() !== user.serial_key.trim())
        return NextResponse.json({ ok: false, message: 'คุณไม่มีสิทธิ์จัดการ Railway Service นี้' }, { status: 403 });
    }

    const envId = service.serviceInstances?.edges?.[0]?.node?.environmentId || null;
    const latest = service.deployments?.edges?.[0]?.node || null;

    const response = NextResponse.json({
      ok: true,
      serviceId: service.id,
      environmentId: envId,
      deploymentId: latest?.id || null,
      status: latest?.status || 'UNKNOWN',
      tenantId: publicTenantKey(bt || { tenantId }),
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
