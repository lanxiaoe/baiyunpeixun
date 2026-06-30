// 数据源管理 API（公开，无需密码）
// R2: 存储原始 Excel 和解析后的 JSON
// D1: 存储元数据

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const type = url.searchParams.get("type"); // json | excel

  // 通用 JSON 响应构造器
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });

  // --- POST: 上传数据源（公开） ---
  if (request.method === "POST") {
    let XLSX = null;
    try {
      const formData = await request.formData();
      const file = formData.get("file");
      const metaStr = formData.get("meta");

      if (!file || !metaStr) {
        return jsonResponse({ error: "缺少 file 或 meta" }, 400);
      }

      const meta = JSON.parse(metaStr);
      const fileName = file.name || "未命名.xlsx";
      const fileSize = Number(file.size) || 0;
      const recordCount = Number(meta.recordCount) || 0;
      const fieldNames = Array.isArray(meta.fieldNames) ? meta.fieldNames : [];

      const dsId = "ds_" + crypto.randomUUID().slice(0, 12);
      const now = new Date().toISOString();

      // 动态加载 XLSX
      XLSX = await loadXLSX();

      const excelBuffer = await file.arrayBuffer();
      const excelBytes = new Uint8Array(excelBuffer);

      const wb = XLSX.read(excelBytes, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" });
      const jsonStr = JSON.stringify(jsonData);

      const r2Key = `json/${dsId}.json`;
      const r2ExcelKey = `excel/${dsId}.xlsx`;

      await env.DATA_BUCKET.put(r2Key, jsonStr, {
        httpMetadata: { contentType: "application/json" }
      });
      await env.DATA_BUCKET.put(r2ExcelKey, excelBytes, {
        httpMetadata: { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
      });

      const metaJson = JSON.stringify(fieldNames);
      const insertResult = await env.D1_DB
        .prepare(`INSERT INTO data_sources (id, file_name, file_size, record_count, field_names, r2_key, r2_excel_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(dsId, fileName, fileSize, recordCount, metaJson, r2Key, r2ExcelKey, now)
        .run();

      if (!insertResult.success) {
        return jsonResponse({ error: "数据库写入失败" }, 500);
      }

      return jsonResponse({
        success: true,
        data: { id: dsId, fileName, recordCount, fieldNames, createdAt: now }
      });

    } catch (err) {
      return jsonResponse({ error: String(err.message || err) }, 500);
    }
  }

  // --- DELETE: 删除数据源（公开） ---
  if (request.method === "DELETE" && id) {
    try {
      const row = await env.D1_DB
        .prepare("SELECT r2_key, r2_excel_key FROM data_sources WHERE id = ?")
        .bind(id)
        .first();

      if (!row) {
        return jsonResponse({ error: "数据源不存在" }, 404);
      }

      await env.DATA_BUCKET.delete(row.r2_key);
      await env.DATA_BUCKET.delete(row.r2_excel_key);

      const delResult = await env.D1_DB
        .prepare("DELETE FROM data_sources WHERE id = ?")
        .bind(id)
        .run();

      return jsonResponse({ success: delResult.success });

    } catch (err) {
      return jsonResponse({ error: String(err.message || err) }, 500);
    }
  }

  // --- GET: 获取数据 ---
  if (request.method === "GET") {
    // 列表（分页）
    if (!id) {
      try {
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
        const pageSize = Math.min(100, parseInt(url.searchParams.get("pageSize") || "20", 10));
        const offset = (page - 1) * pageSize;

        const countRow = await env.D1_DB
          .prepare("SELECT COUNT(*) as total FROM data_sources")
          .first();

        const total = Number(countRow?.total) || 0;

        const listResult = await env.D1_DB
          .prepare("SELECT * FROM data_sources ORDER BY created_at DESC LIMIT ? OFFSET ?")
          .bind(pageSize, offset)
          .all();

        const list = Array.isArray(listResult?.results)
          ? listResult.results.map(r => ({
              id: r.id,
              fileName: r.file_name,
              fileSize: Number(r.file_size),
              recordCount: Number(r.record_count),
              fieldNames: parseFieldNames(r.field_names),
              createdAt: r.created_at
            }))
          : [];

        return jsonResponse({
          success: true,
          data: {
            list,
            pagination: {
              page,
              pageSize,
              total,
              totalPages: Math.ceil(total / pageSize)
            }
          }
        });

      } catch (err) {
        return jsonResponse({ error: String(err.message || err) }, 500);
      }
    }

    // 下载 JSON 明细 ?id=xxx&type=json
    if (type === "json") {
      try {
        const row = await env.D1_DB
          .prepare("SELECT r2_key FROM data_sources WHERE id = ?")
          .bind(id)
          .first();

        if (!row || !row.r2_key) {
          return jsonResponse({ error: "数据源不存在" }, 404);
        }

        const obj = await env.DATA_BUCKET.get(row.r2_key);
        if (!obj) {
          return jsonResponse({ error: "JSON 文件不存在" }, 404);
        }

        const data = await obj.text();
        return new Response(data, {
          headers: { "Content-Type": "application/json" }
        });

      } catch (err) {
        return jsonResponse({ error: String(err.message || err) }, 500);
      }
    }

    // 下载原始 Excel ?id=xxx&type=excel
    if (type === "excel") {
      try {
        const row = await env.D1_DB
          .prepare("SELECT r2_excel_key, file_name FROM data_sources WHERE id = ?")
          .bind(id)
          .first();

        if (!row || !row.r2_excel_key) {
          return jsonResponse({ error: "数据源不存在" }, 404);
        }

        const obj = await env.DATA_BUCKET.get(row.r2_excel_key);
        if (!obj) {
          return jsonResponse({ error: "Excel 文件不存在" }, 404);
        }

        const data = await obj.arrayBuffer();
        return new Response(data, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(row.file_name || 'data.xlsx')}"`
          }
        });

      } catch (err) {
        return jsonResponse({ error: String(err.message || err) }, 500);
      }
    }

    // 获取单条元数据 ?id=xxx
    try {
      const row = await env.D1_DB
        .prepare("SELECT * FROM data_sources WHERE id = ?")
        .bind(id)
        .first();

      if (!row) {
        return jsonResponse({ error: "数据源不存在" }, 404);
      }

      return jsonResponse({
        success: true,
        data: {
          id: row.id,
          fileName: row.file_name,
          fileSize: Number(row.file_size),
          recordCount: Number(row.record_count),
          fieldNames: parseFieldNames(row.field_names),
          createdAt: row.created_at
        }
      });

    } catch (err) {
      return jsonResponse({ error: String(err.message || err) }, 500);
    }
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
}

function parseFieldNames(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function loadXLSX() {
  if (typeof XLSX !== "undefined" && XLSX.read) return XLSX;
  const resp = await fetch("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js");
  if (!resp.ok) throw new Error("XLSX CDN 请求失败: " + resp.status);
  const text = await resp.text();
  if (!text || text.length < 100) throw new Error("XLSX CDN 返回内容无效");
  try {
    eval(text);
  } catch (e) {
    throw new Error("XLSX 执行失败: " + e.message);
  }
  if (typeof XLSX === "undefined" || !XLSX.read) {
    throw new Error("XLSX 加载后未定义");
  }
  return XLSX;
}
