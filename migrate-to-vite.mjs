/**
* 转换 Nextjs 13 src 目录到 vite 项目使用
*/

import fs from 'fs';
import { cp, stat, writeFile } from 'fs/promises';

const [fromSrc, targetSrc] = process.argv.slice(2);
if (!fromSrc || !targetSrc) {
  console.info('eg: node migrate-to-vite.mjs fromDir toDir');
  throw new Error('error parameter');
}

// check folder
await stat('./src');

console.log('::: Start copy: ');
console.log(`cp -R ${fromSrc} ${targetSrc}`);
await cp(fromSrc, targetSrc, { recursive: true });
console.log('::: End copy.');

const routePath = targetSrc + '/app';

function startReadDir(dir) {
  let dirPath = dir;
  // 文件数组
  let res = fs.readdirSync(dirPath);
  //all里的children数组
  let temp = getFileJson(res, [], dirPath);
  return temp;
}
/**
 * @param {A路径下的文件数组} res
 * @param {children数组} arr
 * @param {A路径} dir
 * @returns children数组
 */
function getFileJson(res, arr, dir) {
  res.map((item) => {
    let tempDir = `${dir}/${item}`;
    let obj = newObj(tempDir, item);
    arr.push(obj);
    if (obj.children?.length == 0) {
      let dirValArr = fs.readdirSync(tempDir);
      return getFileJson(dirValArr, obj.children, obj.dirPath);
    }
  });
  return arr;
}
// 处理该目录下生成的obj是否带有children
/**
 * 处理添加到children数组下的对象属性
 * @param {B路径 = A路径 + 文件名} tempDir
 * @param {文件名} item
 * @returns 返回处理好的对象
 */
function newObj(tempDir, item) {
  let obj = {
    name: item,
    dirPath: tempDir,
    path: tempDir.replace(routePath, './app'),
  };
  if (!fs.statSync(tempDir).isFile()) {
    obj.children = [];
    obj.type = 'folder';
  }
  return obj;
}

const dirs = startReadDir(routePath);

function getRoutes(dirs) {
  return dirs
    .filter((dir) => dir.type === 'folder')
    .map((dir) => {
      const accessPath = dir.path.replace('./app', '');

      const hasPage = dir.children.find((file) => file.name.startsWith('page.')) ? true : false;
      const children = getRoutes(dir.children).filter((item) => item);

      if (!hasPage && !children.length) {
        return '';
      }

      return `{
        path: '${accessPath.replace(/\/\(home\)[/]*/, '/')}',
        ${hasPage ? `element: lazy(() => import('${dir.path}/page')),` : ''}
        ${children?.length ? `children: [${children}]` : ''}
    }`
        .replace(/(\n[\s\t]*\r*\n)/g, '\n')
        .replace(/^[\n\r\n\t]*|[\n\r\n\t]*$/g, '');
    });
}

const routes = getRoutes(dirs).filter((item) => item);

const indexTemplate = `import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import Layout from './layout'
import { App } from './app'

ReactDOM.createRoot(document.getElementById('app')!).render(
  <Router>
    <Layout>
      <App />
    </Layout>
  </Router>
)`;

const routesTemplate = `import { FC, LazyExoticComponent, ReactNode, lazy } from 'react'
import { Route } from 'react-router-dom'

interface IRoute {
  path: string
  element?: LazyExoticComponent<() => ReactNode> | LazyExoticComponent<FC>,
  children?: IRoute[]
}

const routes: IRoute[] = [${routes}]

export function renderRoutes (routeList: IRoute[]): ReactNode[] {
  return routeList.map((route: IRoute) => {
    if (route.children) {
      return renderRoutes(route.children)
    }

    return route.element && (
      <Route
        key={route.path}
        path={route.path}
        element={<route.element /> as any}>
        {route.children && renderRoutes(route.children as any)}
      </Route>
    )
  })
}

export default routes
`;

const appTemplate = `import { Routes } from 'react-router-dom'
import routes, { renderRoutes } from './routes'

export function App () {
  return <Routes>{renderRoutes(routes)}</Routes>
}
`;

console.log('\n::: Start Write');
await Promise.all([
  writeFile(targetSrc + '/routes.tsx', routesTemplate),
  writeFile(targetSrc + '/app.tsx', appTemplate),
  writeFile(targetSrc + '/index.tsx', indexTemplate),
]);
console.log('\n::: Write success');
console.log('\n::: Now you can review code');
