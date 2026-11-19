await Bun.write("dist/style.css", Bun.file("src/style.css"));
await Bun.write("dist/index.html", Bun.file("index.html"));
for await (const file of new Bun.Glob("studies/*.webp").scan()) await Bun.write(`dist/${file}`, Bun.file(file));
for (const file of ["fonts/GeistSerif-Regular.woff2", "fonts/GeistSerif-LICENSE.txt"]) await Bun.write(`dist/${file}`, Bun.file(file));
export {};
