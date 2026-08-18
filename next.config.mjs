import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
});

const now = new Date();
const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour12: false,
});
const parts = formatter.formatToParts(now);
const getPart = (type) => parts.find((p) => p.type === type)?.value || "";
const buildTimeStr = `${getPart("hour")}:${getPart("minute")}:${getPart("second")} ${getPart("day")}/${getPart("month")}/${getPart("year")}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIME: buildTimeStr,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withPWA(nextConfig);
