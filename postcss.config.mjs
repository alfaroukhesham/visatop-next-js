/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Tailwind v4 bundles vendor prefixing via Lightning CSS (not legacy autoprefixer).
    // Lightning is off by default in development; enable it (without minify) so Safari/Firefox
    // match production while `next dev` is running.
    "@tailwindcss/postcss": {
      optimize:
        process.env.NODE_ENV === "production"
          ? true
          : { minify: false },
    },
  },
};

export default config;
