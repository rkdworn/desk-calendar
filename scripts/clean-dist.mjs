// npm run build 전에 dist를 지운다(package.json의 prebuild).
//
// Node 24의 fs.rmSync(dir, { recursive: true })가 경로에 한글이 있으면(이 프로젝트 폴더
// "바탕화면캘린더") 프로세스째 죽는다(0xC0000409). Vite가 출력 폴더를 비울 때도 이 함수를
// 써서 빌드가 죽으므로, 미리 파일을 하나씩 지워 Vite가 비울 폴더가 없게 한다.
import { existsSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

function remove(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) remove(path)
    else unlinkSync(path)
  }
  rmdirSync(dir)
}

if (existsSync('dist')) remove('dist')
