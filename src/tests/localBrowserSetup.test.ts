import { afterEach, expect, it, vi } from 'vitest';

const { spawnSync } = vi.hoisted(() => ({ spawnSync: vi.fn() }));
vi.mock('node:child_process', () => ({ spawnSync }));
const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
const argv = process.argv;
afterEach(() => {
  Object.defineProperty(process, 'platform', platform);
  process.argv = argv;
  vi.restoreAllMocks();
  spawnSync.mockReset();
  vi.resetModules();
});
async function run(args: string[] = [], os = 'win32') {
  Object.defineProperty(process, 'platform', { ...platform, value: os });
  process.argv = ['node', 'scripts/setup-local-browser.mjs', ...args];
  await import('../../scripts/setup-local-browser.mjs');
}
it('launches explicit npm.cmd on Windows with unchanged installation arguments and local cache', async () => {
  spawnSync.mockReturnValue({ status: 0 });
  await run();
  const commands = spawnSync.mock.calls.map(call => call[1][2]);
  expect(commands).toEqual([
    'npm.cmd install --save-dev @playwright/test --ignore-scripts --no-audit --no-fund --cache .cache/npm --fetch-retries=0 --fetch-timeout=15000',
    'node node_modules/@playwright/test/cli.js install chromium',
    'npm.cmd run qa:fixture:build',
    'npm.cmd run qa:browser',
  ]);
  for (const [command, args, options] of spawnSync.mock.calls) {
    expect(command).toBe('powershell.exe');
    expect(args.slice(0, 2)).toEqual(['-NoProfile', '-Command']);
    expect(options).toMatchObject({ stdio: 'inherit', windowsHide: true });

    expect(
      options.env.PLAYWRIGHT_BROWSERS_PATH.replaceAll('\\', '/')
    ).toBe(`${options.cwd.replaceAll('\\', '/')}/.cache/playwright`);
  }
});
it('preserves direct npm argument invocation on non-Windows hosts', async () => {
  spawnSync.mockReturnValue({ status: 0 });
  await run([], 'linux');
  expect(spawnSync.mock.calls.map(call => call[0])).toEqual(['npm', 'node', 'npm', 'npm']);
  expect(spawnSync.mock.calls[0][1]).toEqual(['install', '--save-dev', '@playwright/test', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', '.cache/npm', '--fetch-retries=0', '--fetch-timeout=15000']);
});
it('keeps plan mode free of subprocesses', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  await run(['--plan']);
  expect(spawnSync).not.toHaveBeenCalled();
});
it.each([{ status: 7 }, { status: null, error: new Error('blocked') }])('stops without retries when a step fails: %j', async result => {
  spawnSync.mockReturnValue(result);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('test exit'); });
  await expect(run()).rejects.toThrow('test exit');
  expect(spawnSync).toHaveBeenCalledTimes(1);
  expect(exit).toHaveBeenCalledWith(result.status || 1);
});
it('rejects unsupported arguments before spawning', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('test exit'); });
  await expect(run(['--unsafe'])).rejects.toThrow('test exit');
  expect(exit).toHaveBeenCalledWith(2);
  expect(spawnSync).not.toHaveBeenCalled();
});
