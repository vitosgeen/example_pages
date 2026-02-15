export async function onRequest(context) {
    const { request, next, env } = context;
    const url = new URL(request.url);

    // --- LOGIC CHECK ---

    // Variant A: Header check
    // For example, you want to allow only requests with a specific API key
    const secretHeader = request.headers.get("x-custom-auth");

    // Variant B: URL parameter check (e.g., ?token=123)
    const tokenParam = url.searchParams.get("token");

    // Get the secret key from environment variables (set in Pages dashboard)
    // If the variable is not set, use "default-secret" (only for testing!)
    const mySecret = env.SECRET_KEY || "super-secret-password";

    // Check if the header or token matches the secret
    if (secretHeader === mySecret || tokenParam === mySecret) {
        // CHECK PASSED:
        // Call next() to load the requested page from Pages
        return await next();
    }

    // CHECK FAILED:
    // Return our own response (block) and do not call next()
    return new Response("Access denied: Invalid key", { status: 403 });
}