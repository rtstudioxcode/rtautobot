// src/routes/railway.js
import { Router } from "express";
import axios from "axios";
import { config } from "../config.js";

const router = Router();

// ───────── GLOBAL LOG ─────────
const isGlobalLogEnabled = () => {
  return config?.system?.globalLogEnabled === true;
};

const glog = {
  log: (...args) => {
    if (isGlobalLogEnabled()) console.log(...args);
  },
  info: (...args) => {
    if (isGlobalLogEnabled()) console.info(...args);
  },
  warn: (...args) => {
    if (isGlobalLogEnabled()) console.warn(...args);
  },
  error: (...args) => {
    if (isGlobalLogEnabled()) console.error(...args);
  },
};

const RAILWAY_API_URL = "https://backboard.railway.app/graphql/v2";

function getRailwayRuntime() {
  const token = String(config?.railway?.apiToken || "").trim();
  const projectId = String(config?.railway?.projectId || "").trim();

  if (!token) {
    throw new Error("Railway API token is not configured in secure_config.railway.apiToken");
  }

  if (!projectId) {
    throw new Error("Railway project ID is not configured in secure_config.railway.projectId");
  }

  return {
    token,
    projectId,
  };
}

async function railwayQuery(query, variables = {}) {
  try {
    const { token } = getRailwayRuntime();

    const response = await axios.post(
      RAILWAY_API_URL,
      { query, variables },
      {
        timeout: 30000,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data?.errors?.length) {
      const message = response.data.errors
        .map((e) => e?.message)
        .filter(Boolean)
        .join(" | ");

      throw new Error(message || "Railway GraphQL error");
    }

    return response.data;
  } catch (error) {
    glog.error("Railway API Connection Error:", error?.message || error);
    throw error;
  }
}

// ดึงข้อมูล Deployment และ Service ID โดยใช้ TENANTID
router.get("/service-info/:tenantId", async (req, res) => {
  try {
    const tenantId = String(req.params.tenantId || "").trim();

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        error: "Missing tenantId",
      });
    }

    const { projectId } = getRailwayRuntime();

    glog.log(`Searching for Tenant: ${tenantId}`);

    const query = `
      query GetProject($id: String!) {
        project(id: $id) {
          services {
            edges {
              node {
                id
                name
                serviceInstances {
                  edges {
                    node {
                      environmentId
                      variables
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result = await railwayQuery(query, { id: projectId });
    const services = result.data?.project?.services?.edges || [];

    // ค้นหา Service ที่มี TENANTID ตรงกัน แบบไม่สนตัวพิมพ์เล็ก-ใหญ่
    const target = services.find((edge) => {
      const instance = edge.node?.serviceInstances?.edges?.[0]?.node;
      const vars = instance?.variables || {};
      const railwayTenant = vars.TENANTID || vars.tenantId;

      return (
        railwayTenant &&
        String(railwayTenant).toUpperCase() === tenantId.toUpperCase()
      );
    });

    if (!target) {
      return res.status(404).json({
        ok: false,
        error: "ไม่พบ Service ใน Railway",
      });
    }

    const serviceId = target.node.id;
    const envId = target.node?.serviceInstances?.edges?.[0]?.node?.environmentId;

    if (!serviceId || !envId) {
      return res.status(404).json({
        ok: false,
        error: "พบ Service แต่ไม่พบ serviceId หรือ environmentId",
      });
    }

    // ดึง Deployment ล่าสุด
    const deployQuery = `
      query GetLatest($serviceId: String!) {
        service(id: $serviceId) {
          deployments(first: 1) {
            edges {
              node {
                id
                status
              }
            }
          }
        }
      }
    `;

    const dResult = await railwayQuery(deployQuery, { serviceId });
    const latest = dResult.data?.service?.deployments?.edges?.[0]?.node;

    return res.json({
      ok: true,
      serviceId,
      environmentId: envId,
      deploymentId: latest?.id || null,
      status: latest?.status || null,
    });
  } catch (err) {
    glog.error("[railway service-info] failed:", err?.message || err);

    return res.status(500).json({
      ok: false,
      error: err?.message || "failed",
    });
  }
});

// ดึง Logs
router.get("/logs/deploy/:deploymentId", async (req, res) => {
  try {
    const deploymentId = String(req.params.deploymentId || "").trim();

    if (!deploymentId) {
      return res.status(400).json({
        ok: false,
        error: "Missing deploymentId",
      });
    }

    const query = `
      query GetLogs($id: String!) {
        deploymentLogs(deploymentId: $id, limit: 150) {
          message
          timestamp
        }
      }
    `;

    const data = await railwayQuery(query, { id: deploymentId });

    return res.json({
      ok: true,
      logs: data.data?.deploymentLogs || [],
    });
  } catch (err) {
    glog.error("[railway logs] failed:", err?.message || err);

    return res.status(500).json({
      ok: false,
      error: err?.message || "failed",
    });
  }
});

// สั่ง Restart / Redeploy
router.post("/restart", async (req, res) => {
  try {
    const serviceId = String(req.body.serviceId || "").trim();
    const environmentId = String(req.body.environmentId || "").trim();

    if (!serviceId || !environmentId) {
      return res.status(400).json({
        ok: false,
        error: "Missing serviceId or environmentId",
      });
    }

    const mutation = `
      mutation Redeploy($sId: String!, $eId: String!) {
        serviceInstanceRedeploy(serviceId: $sId, environmentId: $eId)
      }
    `;

    const result = await railwayQuery(mutation, {
      sId: serviceId,
      eId: environmentId,
    });

    return res.json({
      ok: true,
      data: result,
    });
  } catch (err) {
    glog.error("[railway restart] failed:", err?.message || err);

    return res.status(500).json({
      ok: false,
      error: err?.message || "failed",
    });
  }
});

export default router;