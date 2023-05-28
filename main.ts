import {APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context} from "https://deno.land/x/lambda@1.32.5/mod.ts";
import {parse as parseCsv} from "https://deno.land/std@0.177.1/encoding/csv.ts"

type Row = {ID: string, URL: string, Link: string}

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

export async function handler(event: APIGatewayProxyEventV2, context: Context): Promise<APIGatewayProxyResultV2> {
  const host = event.headers.host ?? ''
  const matches = host.match(/^(.+?)(?:\.s)?\.kor\.vin/i)
  const subdomain = (matches ? matches[1] : '').toLowerCase()

  let redirect = null
  for (const {ID, URL} of await getCsv()) {
    if (ID.toLowerCase() === subdomain) {
      redirect = URL
    }
  }

  if (redirect) {
    return {
      statusCode: 302,
      body: `Redirecting to <a href='${redirect}'>${redirect}</a>`,
      headers: {
        'Content-Type': 'text/html',
        'Location': redirect
      }
    }
  }
  
  return {
    statusCode: 404,
    body: "Redirect not found."
  }
}