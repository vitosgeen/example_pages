export async function onRequest(context) {
    const { request, next, env } = context;
    const url = new URL(request.url);
    const secretHeader = request.headers.get("x-custom-auth");
    const tokenParam = url.searchParams.get("token");
    const mySecret = env.SECRET_KEY || "super-secret-password";
    if (secretHeader === mySecret || tokenParam === mySecret) {
        return await next();
    }
    return new Response("Access denied: Invalid key", { status: 403 });
}