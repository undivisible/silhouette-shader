await Bun.write("dist/style.css", Bun.file("src/style.css"));
await Bun.write("dist/index.html", Bun.file("index.html"));
export {};
