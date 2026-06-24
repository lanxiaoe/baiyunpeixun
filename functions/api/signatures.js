// 处理用户签名提交与列表查询
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const templateId = url.searchParams.get("templateId");

  if (!templateId) return new Response("Missing templateId", { status: 400 });

  // --- 1. 用户提交签名 (POST) -> 允许公开访问 ---
  if (request.method === "POST") {
    try {
      const { userName, signatureImage } = await request.json();
      if (!userName || !signatureImage) return new Response("Missing fields", { status: 400 });

      const templateMeta = await env.DB.get(`template:meta:${templateId}`);
      if (!templateMeta) {
        return new Response(JSON.stringify({ error: "模板不存在或已被删除" }), { 
          status: 404, 
          headers: { "Content-Type": "application/json" } 
        });
      }

      const signId = crypto.randomUUID().slice(0, 8);
      const key = `sign:data:${templateId}:${userName}_${signId}`;

      await env.DB.put(key, JSON.stringify({
        userName,
        signatureImage,
        signTime: new Date().toISOString()
      }));
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }

  // --- 2. 管理员查看签名列表 (GET) -> 必须验证密码 ---
  if (request.method === "GET") {
    const adminPassword = request.headers.get("X-Admin-Password");
    if (!adminPassword || adminPassword !== env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    try {
      const listResult = await env.DB.list({ prefix: `sign:data:${templateId}:` });
      const promises = listResult.keys.map(k => env.DB.get(k.name, { type: "json" }));
      const signatures = await Promise.all(promises);
      return new Response(JSON.stringify({ signatures }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }
}