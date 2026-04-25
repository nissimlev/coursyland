const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3131;
const MAIN_HTML = path.resolve(__dirname, '../../index.html');
const REPO_ROOT = path.resolve(__dirname, '../..');

function extractCoursesArray(html) {
  const marker = 'const courses = [';
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) throw new Error('לא נמצא מערך courses בקובץ');

  const arrayStart = markerIdx + marker.length - 1; // position of opening [
  let depth = 0;
  let i = arrayStart;

  while (i < html.length) {
    const c = html[i];
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) break;
    }
    i++;
  }

  const arrayStr = html.substring(arrayStart, i + 1);
  const courses = Function('return ' + arrayStr)();
  return { courses, arrayStart, arrayEnd: i + 1 };
}

function formatCourseEntry(course) {
  const fields = Object.entries(course).filter(([, v]) => v !== undefined && v !== '');
  const inner = fields.map(([k, v]) => {
    const val = typeof v === 'string'
      ? `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      : v;
    return `    ${k}: ${val}`;
  }).join(',\n');
  return `  {\n${inner}\n  }`;
}

function insertCourseIntoHTML(html, newCourse, arrayStart, arrayEnd) {
  const segment = html.substring(arrayStart, arrayEnd);
  const lastBrace = segment.lastIndexOf('}');
  if (lastBrace === -1) {
    // Empty array — insert first element
    const insertAt = arrayStart + 1;
    return html.substring(0, insertAt) + '\n' + formatCourseEntry(newCourse) + '\n' + html.substring(insertAt);
  }
  const insertAt = arrayStart + lastBrace + 1;
  return (
    html.substring(0, insertAt) +
    ',\n' + formatCourseEntry(newCourse) + '\n' +
    html.substring(insertAt)
  );
}

function runGit(title, instructor, cb) {
  const msg = `Add course: ${title} by ${instructor}`.replace(/"/g, '\\"');
  const cmd = [
    `cd "${REPO_ROOT}"`,
    `git add index.html`,
    `git commit -m "${msg}"`,
    `git push origin main`
  ].join(' && ');
  exec(cmd, { shell: '/bin/zsh' }, (err, stdout, stderr) => cb(err, stdout + stderr));
}

function serveFile(res, filePath, contentType) {
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // GET /api/courses
  if (req.url === '/api/courses' && req.method === 'GET') {
    try {
      const html = fs.readFileSync(MAIN_HTML, 'utf8');
      const { courses } = extractCoursesArray(html);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(courses));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/add-course
  if (req.url === '/api/add-course' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        const course = JSON.parse(body);
        const html = fs.readFileSync(MAIN_HTML, 'utf8');
        const { courses, arrayStart, arrayEnd } = extractCoursesArray(html);

        const maxId = courses.reduce((m, c) => Math.max(m, c.id || 0), 0);
        course.id = maxId + 1;

        const updated = insertCourseIntoHTML(html, course, arrayStart, arrayEnd);
        fs.writeFileSync(MAIN_HTML, updated, 'utf8');

        runGit(course.title, course.instructor, (err, output) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'git נכשל: ' + err.message, output }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, id: course.id, output }));
          }
        });
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Serve index.html
  if (req.url === '/' || req.url === '/index.html') {
    serveFile(res, path.join(__dirname, 'index.html'), 'text/html');
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n✅  Admin Tool — הוספת קורס`);
  console.log(`🌐  http://localhost:${PORT}\n`);
});
