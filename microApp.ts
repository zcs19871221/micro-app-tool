#!/usr/bin/env node
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */

import * as http from 'http';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, exec, execSync, ChildProcess } from 'child_process';
import open from 'open';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const overRide = path.join(__dirname, 'override.json');
const tmp = tmpdir();

interface OverRide {
  [key: string]: {
    locate?: string;
    command?: string;
  };
}

const readOverrideConfig = (): OverRide => {
  return fs.existsSync(overRide)
    ? JSON.parse(fs.readFileSync(overRide, 'utf-8'))
    : {};
};

const overRideConfigs = readOverrideConfig();

const projects: Project[] = [
  {
    key: 'bff-server',
    locate: 'c:/work/eh-bff',
    command: 'npm run devserver',
  },
  {
    key: 'ui-server',
    locate: 'c:/work/eh-ui',
    command: 'npm run devserver',
  },
  {
    key: 'eh-ui',
    locate: 'c:/work/eh-ui',
    command: 'npm run devBuild',
  },
  {
    key: 'eh-bff',
    locate: 'c:/work/eh-bff',
  },
  {
    key: 'xiot-ui',
    locate: 'c:/work/xiot-ui',
  },
  {
    key: 'xiot-bff',
    locate: 'c:/work/xiot-bff',
  },
  {
    key: 'auth-ui',
    locate: 'c:/work/comp-auth-ui',
  },
  {
    key: 'auth-bff',
    locate: 'c:/work/comp-auth-bff',
  },
  {
    key: 'vee-ui',
    locate: 'c:/work/comp-data-quality-ui',
  },
  {
    key: 'vee-bff',
    locate: 'c:/work/comp-data-quality-bff',
  },
].map((p): Project => {
  let newProject: Project = {
    ...p,
    log: path.join(tmp, `${p.key}out.log`),
    errLog: path.join(tmp, `${p.key}err.log`),
    status: 'loading',
  };

  if (overRideConfigs[p.key]) {
    newProject = {
      ...newProject,
      ...overRideConfigs[p.key],
    };
  }
  fs.writeFileSync(newProject.log, '');
  fs.writeFileSync(newProject.errLog, '');
  return newProject;
});

const writeOverrideConfig = (key: string, locate: string) => {
  const t = projects.find((p) => p.key === key);
  if (t) {
    t.locate = locate;
    overRideConfigs[key] = {
      locate,
    };
    fs.writeFileSync(overRide, JSON.stringify(overRideConfigs, null, 2));
  }
};
interface Project {
  status: 'success' | 'error' | 'loading';
  key: string;
  locate: string;
  command?: string;
  log: string;
  errLog: string;
  child?: ChildProcess | null;
}

const isServer = (project: Project) => project.key.includes('-server');

const htmlHandler = (res: http.ServerResponse) => {
  let html = '';
  const ports = new Set();
  try {
    html = fs
      .readFileSync(path.join(__dirname, './server.html'), 'utf-8')
      .replace(
        '{placeHolder}',
        projects
          .map((project) => {
            const port = getPort(project);
            const proxy = getProxy(project) ?? '';
            const server = isServer(project);
            let color = '';
            switch (project.status) {
              case 'loading':
                color = 'grey';
                break;
              case 'error':
                color = 'red';
                break;
              case 'success':
                color = 'green';
                break;
              default:
                break;
            }
            let portColor = 'black';
            if (ports.has(port)) {
              portColor = 'red';
            }

            ports.add(port);
            return `
                <tr data-key="${project.key}">
                  <td>${project.key}</th>
                  <td class="status ${project.child ? 'opened' : 'closed'}">${
              project.child != null ? '已开启' : '已关闭'
            }<span style="color:${color}">${
              !server ? project.status : ''
            }</span>
                  </td>
                  <td>
                    <button class="start">打开</button>
                    <button class="stop">关闭</button>
                    <button class="restart">重启</button>
                    <button class="vscode">vscode</button>
                  </td>
                    <td>
                      <button class="log">日志</button>
                      <button class="errLog">错误日志</button>
                    </td>
                    <td>
                      <label class="locateLabel">${project.locate}</label>
                      <input type="text" value="${
                        project.locate
                      }" class="locateInput" data-type="locate"/>
                    </td>
                    <td>
                      <label class="locateLabel" style="color:${portColor}">${port}</label>
                      <input type="text" value="${port}" class="locateInput" data-type="port"/>
                    </td>
                    <td style="width:60px;height:30px">
                      <pre class="locateLabel" style="width: 100%;height:100%">${proxy}</pre>
                      <textarea  style="width: 100%;height:100%" value="${proxy}" class="locateInput" data-type="proxy" ></textarea>
                    </td>
                </tr>`;
          })
          .join('')
      );
  } catch (err: any) {
    html = `<div>error: ${err?.message ?? err}</div>`;
  }

  res.setHeader('content-type', 'text/html');
  res.end(html);
};

const stop = (project: Project) => {
  if (project.child) {
    spawn('taskkill', ['/pid', String(project.child.pid), '/f', '/t']);
    console.log(`kill process: ${project.key}`);
    project.child = null;
  }
};
const start = (project: Project) => {
  if (project.child === null || project.child === undefined) {
    project.child = exec(project.command ?? 'npm run build', {
      cwd: project.locate,
    });

    fs.writeFileSync(project.log, '');
    fs.writeFileSync(project.errLog, '');

    project.child?.stdout?.on('data', (data) => {
      const msg = String(data);
      if (msg.includes('registeration result: 200 200')) {
        project.status = 'success';
      }
      if (msg.includes('Compiled with some errors ')) {
        project.status = 'error';
      }

      fs.appendFileSync(project.log, data);
    });
    project.child?.stderr?.on('data', (data) => {
      const msg = String(data);
      if (msg.includes('address already in use') || msg.includes('Error in ')) {
        project.status = 'error';
      }
      fs.appendFileSync(project.errLog, data);
    });
  }
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });

const restart = async (project: Project) => {
  stop(project);
  await wait(2000);
  start(project);
};

const restartServer = async (project: Project) => {
  restart(project);
  const startedProjects = projects.filter(
    (p) =>
      !isServer(p) &&
      p.child &&
      p.key.includes(project.key.startsWith('bff') ? '-bff' : '-ui')
  );
  await wait(2000);
  start(project);
  startedProjects.forEach(restart);
};

const configFile = 'project.js';

export const getPort = (project: Project) => {
  const locate = project.locate;
  if (project.key.endsWith('-server')) {
    const config = fs.readFileSync(path.join(locate, '.env'), 'utf-8');
    if (project.key.includes('bff')) {
      return config.match(/BFF_SERVER_PORT\s*=\s*(\d+)/)?.[1];
    }
    return config.match(/RENDER_SERVER_PORT\s*=\s*(\d+)/)?.[1];
  }
  const config = fs.readFileSync(path.join(locate, configFile), 'utf-8');
  return config.match(/port['"]?: (\d+),/)?.[1];
};

export const writePort = (project: Project, port: string) => {
  const locate = path.join(project.locate, configFile);
  const config = fs.readFileSync(locate, 'utf-8');
  fs.writeFileSync(
    locate,
    config.replace(/(port['"]?: )(\d+),/, (_, prev) => prev + port + ',')
  );
};

const proxyFile = '/node_modules/@hi/render-server/middleware/apiProxy.js';

export const getProxy = (project: Project) => {
  const p = path.join(project.locate, proxyFile);
  if (!fs.existsSync(p)) {
    return '';
  }
  const config = fs.readFileSync(p, 'utf-8');
  return config.match(/router:[\s]*(\{[^}]+\})/)?.[1];
};

export const writeProxy = (project: Project, jsonString: string) => {
  const locate = path.join(project.locate, proxyFile);
  if (!fs.existsSync(locate)) {
    return '';
  }
  let config = fs.readFileSync(locate, 'utf-8');
  const curProxy = getProxy(project);
  if (curProxy) {
    config = config.replace(curProxy, jsonString);
  } else {
    config = config.replace(
      'secure: true',
      `secure: true,router:${jsonString}`
    );
  }
  fs.writeFileSync(locate, config);
};
const apiHandler = async (res: http.ServerResponse, url: string) => {
  const response = {
    statusCode: 200,
    data: '',
  };
  let sented = false;
  try {
    const [, , operation, projectKey, configType, configValue] = url.split('/');
    const project = projects.find((p) => p.key === projectKey);

    if (!project) {
      response.statusCode = 400;
      response.data = 'not valid project key';
      res.end('not valid project key');
      return;
    }

    switch (operation) {
      case 'start':
        start(project);
        break;
      case 'stop':
        stop(project);
        break;
      case 'restart':
        if (isServer(project)) {
          await restartServer(project);
        } else {
          await restart(project);
        }
        break;
      case 'vscode':
        execSync(`code ${project.locate}`);
        break;
      case 'log':
        sented = true;
        res.end(fs.readFileSync(project.log));
        break;
      case 'errLog':
        sented = true;
        res.end(fs.readFileSync(project.errLog));
        break;
      case 'logClear':
        fs.writeFileSync(project.log, '');
        break;
      case 'errLogClear':
        fs.writeFileSync(project.errLog, '');
        break;
      case 'setConfig':
        {
          switch (configType) {
            case 'locate':
              writeOverrideConfig(project.key, decodeURIComponent(configValue));
              break;
            case 'port':
              writePort(project, decodeURIComponent(configValue));
              break;
            case 'proxy':
              writeProxy(project, decodeURIComponent(configValue));
              break;
            default:
              break;
          }
        }
        break;
      default:
        throw new Error(`not valid operation: ${operation}`);
    }
  } catch (err: any) {
    console.error(err);
    response.statusCode = 500;
    response.data = err.stack ?? err.message;
  } finally {
    if (!sented) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(response));
    }
  }
};

const port = 8888;
http
  .createServer((req, res) => {
    const { url } = req;
    if (!url) {
      return;
    }
    if (!url.startsWith('/api')) {
      htmlHandler(res);
      return;
    }
    apiHandler(res, url);
  })
  .listen(port, () => {
    const serverProjects = projects.filter((p) => isServer(p));
    const ehProjects = projects.filter((p) => p.key.includes('eh-'));
    serverProjects.forEach(start);
    wait(500).then(() => {
      ehProjects.forEach(start);
    });
    open(`http://localhost:${port}`);
    console.log(`controller start at ${port}`);
  });
