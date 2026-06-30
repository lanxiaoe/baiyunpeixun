// 数据源管理 API（公开，无需密码）
// R2: 存储原始 Excel 和解析后的 JSON
// D1: 存储元数据

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const type = url.searchParams.get("type"); // json | excel

  // --- POST: 上传数据源（公开） ---
  if (request.method === "POST") {
    try {
      const formData = await request.formData();
      const file = formData.get("file");
      const metaStr = formData.get("meta");

      if (!file || !metaStr) {
        return new Response(JSON.stringify({ error: "缺少 file 或 meta" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const meta = JSON.parse(metaStr);
      const fileName = file.name || "未命名.xlsx";
      const fileSize = file.size;
      const recordCount = meta.recordCount || 0;
      const fieldNames = meta.fieldNames || [];

      const dsId = "ds_" + crypto.randomUUID().slice(0, 12);
      const now = new Date().toISOString();

      const excelBuffer = await file.arrayBuffer();
      const excelBytes = new Uint8Array(excelBuffer);

      const XLSX = await loadXLSX();
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

      await env.DB.prepare(`
        INSERT INTO data_sources (id, file_name, file_size, record_count, field_names, r2_key, r2_excel_key, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        dsId, fileName, fileSize, recordCount,
        JSON.stringify(fieldNames), r2Key, r2ExcelKey, now
      ).run();

      return new Response(JSON.stringify({
        success: true,
        data: { id: dsId, fileName, recordCount, fieldNames, createdAt: now }
      }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // --- DELETE: 删除数据源（公开） ---
  if (request.method === "DELETE" && id) {
    try {
      const row = await env.DB.prepare("SELECT r2_key, r2_excel_key FROM data_sources WHERE id = ?").bind(id).first();
      if (!row) {
        return new Response(JSON.stringify({ error: "数据源不存在" }), { status: 404, headers: { "Content-Type": "application/json" } });
      }
      await env.DATA_BUCKET.delete(row.r2_key);
      await env.DATA_BUCKET.delete(row.r2_excel_key);
      await env.DB.prepare("DELETE FROM data_sources WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }

  // --- GET: 获取数据 ---
  if (request.method === "GET") {
    if (!id) {
      // 列表（分页）
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
      const pageSize = Math.min(100, parseInt(url.searchParams.get("pageSize") || "20"));
      const offset = (page - 1) * pageSize;

      try {
        const countResult = await env.DB.prepare("SELECT COUNT(*) as total FROM data_sources").first();
        const total = countResult.total;
        const listResult = await env.DB.prepare(
          "SELECT * FROM data_sources ORDER BY created_at DESC LIMIT ? OFFSET ?"
        ).bind(pageSize, offset).all();

        return new Response(JSON.stringify({
          success: true,
          data: {
            list: listResult.results.map(formatRow),
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
          }
        }), { headers: { "Content-Type": "application/json" } });

      } catch (err) {
        return new Response(err.message, { status: 500 });
      }
    }

    // 下载 JSON 明细 ?id=xxx&type=json
    if (type === "json") {
      try {
        const row = await env.DB.prepare("SELECT r2_key FROM data_sources WHERE id = ?").bind(id).first();
        if (!row) return new Response("Not found", { status: 404 });
        const obj = await env.DATA_BUCKET.get(row.r2_key);
        if (!obj) return new Response("Not found", { status: 404 });
        const data = await obj.text();
        return new Response(data, { headers: { "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(err.message, { status: 500 });
      }
    }

    // 下载原始 Excel ?id=xxx&type=excel
    if (type === "excel") {
      try {
        const row = await env.DB.prepare("SELECT r2_excel_key, file_name FROM data_sources WHERE id = ?").bind(id).first();
        if (!row) return new Response("Not found", { status: 404 });
        const obj = await env.DATA_BUCKET.get(row.r2_excel_key);
        if (!obj) return new Response("Not found", { status: 404 });
        const data = await obj.arrayBuffer();
        return new Response(data, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(row.file_name)}"`
          }
        });
      } catch (err) {
        return new Response(err.message, { status: 500 });
      }
    }

    // 获取单条元数据 ?id=xxx
    try {
      const row = await env.DB.prepare("SELECT * FROM data_sources WHERE id = ?").bind(id).first();
      if (!row) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true, data: formatRow(row) }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}

function formatRow(row) {
  return {
    id: row.id,
    fileName: row.file_name,
    fileSize: row.file_size,
    recordCount: row.record_count,
    fieldNames: JSON.parse(row.field_names || "[]"),
    createdAt: row.created_at
  };
}

async function loadXLSX() {
  if (typeof XLSX !== "undefined") return XLSX;
  const resp = await fetch("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js");
  const text = await resp.text();
  eval(text);
  return XLSX;
}
