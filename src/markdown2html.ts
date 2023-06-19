import * as fs from 'fs';
import { marked } from 'marked';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import * as vega from 'vega';
import * as lite from 'vega-lite';

export async function markdown2html(text:string, title:string) {
  const options = {
    prefix: '',
    suffix: '',
    unique: true
  };
  marked.use(gfmHeadingId(options));

  // Vega-Lite to SVG
  const markdown = await replaceAsync(text, /```vega-lite([\s\S]*?)```/g, async (_:string, code:string):Promise<string> => { 
    let vegaspec = lite.compile(JSON.parse(code)).spec
    var view = new vega.View(vega.parse(vegaspec), {renderer: "none"})
    return `${await view.toSVG()}`
  })

  // Markdown to HTML
  const html = marked(markdown, { mangle: false })

  const htmlHead = `<!DOCTYPE html>
<html><head>
<title>${title}</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.2.3/dist/mermaid.min.js"></script>
<style>
  body {
    margin-left:30px;
  }
</style>
</head>
<body>`

const htmlFooter = `
<script>
  mermaid.initialize();
  mermaid.run({querySelector: '.language-mermaid'});
</script>
</body></html>
`
  return `${htmlHead}${html}${htmlFooter}`
}

async function replaceAsync(target:string, regex:RegExp, replacer:(match:string, ...args:any[]) => Promise<string>) {
  const promises:Promise<{ match: string, code: string; }>[] = [];
  target.replace(regex, (match:string, ...args:any[]) => {
    const promise = new Promise<{ match: string; code: string; }> ( async (resolve, reject) => {
      const code:string = await replacer(match, ...args)
      resolve({ match, code })
    })
    promises.push(promise);
    return ''
  });
  const results = await Promise.all(promises)
  results.forEach(({ match, code }) => {
    target = target.replace(match, code)
  })
  return target
}
