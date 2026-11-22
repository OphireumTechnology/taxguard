/** Compatibility entrypoint for AI Studio development previews.
 * Always start the real server; never substitute a frontend-only health endpoint.
 * Startup failures propagate and remain visible.
 */
import '../server.ts';
