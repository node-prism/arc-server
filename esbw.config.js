export default {
  artifactsCommon: {
    bundle: true,
    platform: "node",
    sourcemap: true,
  },
  artifacts: {
    main: {
      format: "esm",
      entryPoints: ["src/index.ts"],
      outfile: "lib/index.js",
    },
    mainCJS: {
      format: "cjs",
      entryPoints: ["src/index.ts"],
      outfile: "lib/index.cjs.js",
    },
  },
  serveMode: {
    index: "public/index.html",
    build: ["main"],
    watchPaths: ["src/**/*.{ts,tsx}", "public/index.html"],
    injectArtifacts: ["main"],
  },
  runMode: {
    build: ["main"],
    watchPaths: ["src/**/*.{ts,tsx}"],
    runfile: "lib/index.js",
  },
  watchMode: {
    build: ["main"],
    watchPaths: ["src/**/*.{ts,tsx}"],
  },
  buildMode: {
    build: ["main", "mainCJS"],
    minify: true,
    minifyWhitespace: true,
  }
}
