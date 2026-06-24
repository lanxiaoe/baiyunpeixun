// 处理模板的上传(POST)、获取(GET)与联动级联删除(DELETE)
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const templateId = url.searchParams.get("templateId");

  // 🔒 统一安全验证
  const adminPassword = request.headers.get("X-Admin-Password");
  if (!adminPassword || adminPassword !== env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: "密码错误，拒绝访问！" }), { 
      status: 401, 
      headers: { "Content-Type": "application/json" } 
    });
  }

  // --- 场景一：联动级联删除模板及签名 (DELETE) ---
  if (request.method === "DELETE") {
    if (!templateId) return new Response("Missing templateId", { status: 400 });
    try {
      // 1. 扫描并删除该模板下所有人的签名数据
      const sigList = await env.DB.list({ prefix: `sign:data:${templateId}:` });
      for (const sk of sigList.keys) {
        await env.DB.delete(sk.name);
      }

      // 2. 删除模板文件和元数据
      await env.DB.delete(`template:file:${templateId}`);
      await env.DB.delete(`template:meta:${templateId}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // --- 场景二：管理员上传模板 (POST) ---
  if (request.method === "POST") {
    if (!templateId) return new Response("Missing templateId", { status: 400 });
    try {
      const formData = await request.formData();
      const file = formData.get("file");
      const meta = formData.get("meta"); 

      if (!file || !meta) return new Response("Missing file or meta", { status: 400 });

      await env.DB.put(`template:file:${templateId}`, await file.arrayBuffer());
      await env.DB.put(`template:meta:${templateId}`, meta);

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }

  // --- 场景三：获取数据列表或详情 (GET) ---
  if (request.method === "GET") {
    if (!templateId) {
      try {
        const listResult = await env.DB.list({ prefix: "template:meta:" });
        const templates = [];

        for (const k of listResult.keys) {
          const id = k.name.split(":")[2]; 
          const metaStr = await env.DB.get(k.name);
          const meta = JSON.parse(metaStr || "{}");

          const sigList = await env.DB.list({ prefix: `sign:data:${id}:` });
          const signees = sigList.keys.map(sk => {
            const parts = sk.name.split(":");
            return parts[parts.length - 1].split("_")[0]; 
          });

          templates.push({
            templateId: id,
            fileName: meta.fileName || "未命名文件",
            signCount: signees.length,
            signees: signees
          });
        }
        return new Response(JSON.stringify({ templates }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(err.message, { status: 500 });
      }
    }

    const type = url.searchParams.get("type"); 
    if (type === "meta") {
      const meta = await env.DB.get(`template:meta:${templateId}`);
      if (!meta) return new Response("Meta not found", { status: 404 });
      return new Response(meta, { headers: { "Content-Type": "application/json" } });
    } 
    if (type === "file") {
      const fileBuffer = await env.DB.get(`template:file:${templateId}`, { type: "arrayBuffer" });
      if (!fileBuffer) return new Response("File not found", { status: 404 });
      return new Response(fileBuffer, { headers: { "Content-Type": "application/pdf" } });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}