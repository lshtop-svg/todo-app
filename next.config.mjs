/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    dirs: ['app', 'components', 'lib', 'models', 'store', 'types', 'tests', 'scripts'],
  },
};

export default nextConfig;
