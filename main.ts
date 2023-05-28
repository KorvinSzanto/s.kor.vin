import {parse as parseCsv} from 'https://deno.land/std@0.82.0/encoding/csv.ts'

type Row = {ID: string, URL: string, Link: string}

const server = Deno.listen({ port: 5135 })

if (typeof Deno.env.get('SHEET') === 'undefined') {
  throw "No sheet URL provided."
}

const sheet = Deno.env.get('SHEET') as string

let csv: Row[] = []
let last = 0
async function getCsv() {
  if (last < (new Date).getTime()) {
    last = (new Date).getTime() + (60 * 1000)
    const raw = await fetch(sheet)
    csv = await parseCsv(await raw?.text(), {skipFirstRow: true}) as Row[]
  }
  return csv
}

for await (const conn of server) {
  serveHttp(conn)
}

async function serveHttp(conn: Deno.Conn) {
  const httpConn = Deno.serveHttp(conn)
  for await (const requestEvent of httpConn) {
    const host = requestEvent.request.headers.get('host') ?? ''
    const matches = host.match(/^(.+?)(?:\.s)?\.kor\.vin/i)
    const subdomain = (matches ? matches[1] : '').toLowerCase()

    let redirect = null
    for (const {ID, URL} of await getCsv()) {
      if (ID.toLowerCase() === subdomain) {
        redirect = URL
      }
    }

    if (redirect) {
      requestEvent.respondWith(new Response(null, {
        status: 302,
        headers: [
          ['Location', redirect]
        ]
      }))
    } else {
      requestEvent.respondWith(new Response("Redirect not found.", {status: 404}))
    }
  }
}