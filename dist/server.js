const { McpServer: BaseMcpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");

// 常量定义
const X_PI = Math.PI * 3000.0 / 180.0;
const OFFSET = 0.00669342162296594323;
const AXIS = 6378245.0;
const EARTH_RADIUS = 6378137.0;
const INITIAL_RESOLUTION = 2 * Math.PI * EARTH_RADIUS / 256.0;
const ORIGIN_SHIFT = 2 * Math.PI * EARTH_RADIUS / 2.0;

class GeoServer extends BaseMcpServer {
  constructor(options = {}) {
    super({
      name: options.name || "GeoProcessingServer",
      version: options.version || "1.0.0"
    });

    this.initializeTools();
  }

  // 计算两点之间的距离（米）
  calculateDistance(lon1, lat1, lon2, lat2) {
    // 先将经纬度转换为Web Mercator坐标
    const [x1, y1] = this.lngLatToWebMercator(lon1, lat1);
    const [x2, y2] = this.lngLatToWebMercator(lon2, lat2);
    
    // 使用平面距离公式计算
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // 计算折线总长度
  calculatePolylineLength(coordinates) {
    let totalDistance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const [lon1, lat1] = coordinates[i];
      const [lon2, lat2] = coordinates[i + 1];
      totalDistance += this.calculateDistance(lon1, lat1, lon2, lat2);
    }
    return Math.round(totalDistance * 10000) / 10000;
  }

  // 计算多边形面积（平方米）
  calculatePolygonArea(coordinates) {
    // 确保多边形闭合
    if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
        coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
      coordinates = [...coordinates, coordinates[0]];
    }

    // 转换为Web Mercator坐标
    const mercatorCoords = coordinates.map(([lon, lat]) => this.lngLatToWebMercator(lon, lat));

    // 使用平面坐标系下的多边形面积计算公式
    let area = 0;
    for (let i = 0; i < mercatorCoords.length - 1; i++) {
      const [x1, y1] = mercatorCoords[i];
      const [x2, y2] = mercatorCoords[i + 1];
      area += (x1 * y2 - x2 * y1);
    }

    // 取绝对值并除以2
    return Math.abs(area) / 2;
  }

  // 坐标转换函数
  BD09toGCJ02(lon, lat) {
    const x = lon - 0.0065;
    const y = lat - 0.006;
    const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
    const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
    const gLon = z * Math.cos(theta);
    const gLat = z * Math.sin(theta);
    return [gLon, gLat];
  }

  GCJ02toBD09(lon, lat) {
    const z = Math.sqrt(lon * lon + lat * lat) + 0.00002 * Math.sin(lat * X_PI);
    const theta = Math.atan2(lat, lon) + 0.000003 * Math.cos(lon * X_PI);
    const bdLon = z * Math.cos(theta) + 0.0065;
    const bdLat = z * Math.sin(theta) + 0.006;
    return [bdLon, bdLat];
  }

  transform(lon, lat) {
    const lonlat = lon * lat;
    const absX = Math.sqrt(Math.abs(lon));
    const lonPi = lon * Math.PI;
    const latPi = lat * Math.PI;
    let d = 20.0 * Math.sin(6.0 * lonPi) + 20.0 * Math.sin(2.0 * lonPi);
    let x = d;
    let y = d;
    x += 20.0 * Math.sin(latPi) + 40.0 * Math.sin(latPi / 3.0);
    y += 20.0 * Math.sin(lonPi) + 40.0 * Math.sin(lonPi / 3.0);
    x += 160.0 * Math.sin(latPi / 12.0) + 320 * Math.sin(latPi / 30.0);
    y += 150.0 * Math.sin(lonPi / 12.0) + 300.0 * Math.sin(lonPi / 30.0);
    x *= 2.0 / 3.0;
    y *= 2.0 / 3.0;
    x += -100.0 + 2.0 * lon + 3.0 * lat + 0.2 * lat * lat + 0.1 * lonlat + 0.2 * absX;
    y += 300.0 + lon + 2.0 * lat + 0.1 * lon * lon + 0.1 * lonlat + 0.1 * absX;
    return [x, y];
  }

  isOutOfChina(lon, lat) {
    return !(lon > 72.004 && lon < 135.05 && lat > 3.86 && lat < 53.55);
  }

  delta(lon, lat) {
    const [dlat, dlon] = this.transform(lon - 105.0, lat - 35.0);
    const radlat = lat / 180.0 * Math.PI;
    const magic = Math.sin(radlat);
    const sqrtmagic = Math.sqrt(1 - OFFSET * magic * magic);
    const dlat2 = (dlat * 180.0) / ((AXIS * (1 - OFFSET)) / (magic * sqrtmagic) * Math.PI);
    const dlon2 = (dlon * 180.0) / (AXIS / sqrtmagic * Math.cos(radlat) * Math.PI);
    const mgLat = lat + dlat2;
    const mgLon = lon + dlon2;
    return [mgLon, mgLat];
  }

  WGS84toGCJ02(lon, lat) {
    if (this.isOutOfChina(lon, lat)) {
      return [lon, lat];
    }
    return this.delta(lon, lat);
  }

  GCJ02toWGS84(lon, lat) {
    if (this.isOutOfChina(lon, lat)) {
      return [lon, lat];
    }
    const [mgLon, mgLat] = this.delta(lon, lat);
    return [lon * 2 - mgLon, lat * 2 - mgLat];
  }

  BD09toWGS84(lon, lat) {
    const [gcjLon, gcjLat] = this.BD09toGCJ02(lon, lat);
    return this.GCJ02toWGS84(gcjLon, gcjLat);
  }

  WGS84toBD09(lon, lat) {
    const [gcjLon, gcjLat] = this.WGS84toGCJ02(lon, lat);
    return this.GCJ02toBD09(gcjLon, gcjLat);
  }

  webMercatorToLngLat(x, y) {
    const lng = (x / ORIGIN_SHIFT) * 180.0;
    let lat = (y / ORIGIN_SHIFT) * 180.0;
    lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180.0)) - Math.PI / 2.0);
    return [lng, lat];
  }

  lngLatToWebMercator(lng, lat) {
    const x = lng * ORIGIN_SHIFT / 180.0;
    const y = Math.log(Math.tan((90 + lat) * Math.PI / 360.0)) / (Math.PI / 180.0);
    const y2 = y * ORIGIN_SHIFT / 180.0;
    return [x, y2];
  }

  initializeTools() {
    // 坐标转换工具
    this.tool(
      "mcp_geo_convert",
      "在不同坐标系统之间转换坐标。支持BD09（百度）、GCJ02（火星）、WGS84（GPS）和Web Mercator投影坐标系统之间的互相转换。",
      {
        method: z.enum([
          "BD09toGCJ02",
          "GCJ02toBD09",
          "WGS84toGCJ02",
          "GCJ02toWGS84",
          "BD09toWGS84",
          "WGS84toBD09",
          "WebMercatortoLngLat",
          "LngLattoWebMercator"
        ]).describe("转换方法"),
        longitude: z.number().describe("经度"),
        latitude: z.number().describe("纬度")
      },
      async ({ method, longitude, latitude }) => {
        try {
          let result;
          switch (method) {
            case "BD09toGCJ02":
              result = this.BD09toGCJ02(longitude, latitude);
              break;
            case "GCJ02toBD09":
              result = this.GCJ02toBD09(longitude, latitude);
              break;
            case "WGS84toGCJ02":
              result = this.WGS84toGCJ02(longitude, latitude);
              break;
            case "GCJ02toWGS84":
              result = this.GCJ02toWGS84(longitude, latitude);
              break;
            case "BD09toWGS84":
              result = this.BD09toWGS84(longitude, latitude);
              break;
            case "WGS84toBD09":
              result = this.WGS84toBD09(longitude, latitude);
              break;
            case "WebMercatortoLngLat":
              result = this.webMercatorToLngLat(longitude, latitude);
              break;
            case "LngLattoWebMercator":
              result = this.lngLatToWebMercator(longitude, latitude);
              break;
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                method,
                input: { longitude, latitude },
                output: { longitude: result[0], latitude: result[1] }
              }, null, 2)
            }]
          };
        } catch (err) {
          return {
            content: [{
              type: "text",
              text: `错误: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    // 距离计算工具
    this.tool(
      "mcp_geo_calculate_distance",
      "计算折线的距离。支持多种坐标系统输入，内部会先转换为WGS84坐标，再通过Web Mercator投影进行平面距离计算。适用于中小尺度的距离计算。",
      {
        coordinates: z.array(z.array(z.number())).min(2).describe("折线坐标点数组，格式：[[lon1,lat1], [lon2,lat2],...]"),
        unit: z.enum(["meters", "kilometers"]).default("meters").describe("长度单位：meters(米)或kilometers(千米)"),
        coordType: z.enum(["WGS84", "GCJ02", "BD09"]).default("WGS84").describe("输入坐标类型")
      },
      async ({ coordinates, unit, coordType }) => {
        try {
          // 如果不是WGS84坐标，先转换为WGS84
          let wgs84Coordinates = coordinates;
          if (coordType === "GCJ02") {
            wgs84Coordinates = coordinates.map(([lon, lat]) => this.GCJ02toWGS84(lon, lat));
          } else if (coordType === "BD09") {
            wgs84Coordinates = coordinates.map(([lon, lat]) => this.BD09toWGS84(lon, lat));
          }

          let distance = this.calculatePolylineLength(wgs84Coordinates);
          
          // 如果单位是千米，则转换
          if (unit === "kilometers") {
            distance = distance / 1000;
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                distance: distance,
                unit: unit,
                coordinates: coordinates,
                coordType: coordType
              }, null, 2)
            }]
          };
        } catch (err) {
          return {
            content: [{
              type: "text",
              text: `错误: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );

    // 面积计算工具
    this.tool(
      "mcp_geo_calculate_area",
      "计算多边形面积。支持多种坐标系统输入，内部会先转换为WGS84坐标，再通过Web Mercator投影进行平面面积计算。多边形无需手动闭合。适用于中小尺度的面积计算。",
      {
        coordinates: z.array(z.array(z.number())).min(3).describe("多边形坐标点数组，格式：[[lon1,lat1], [lon2,lat2],...]"),
        unit: z.enum(["square_meters", "square_kilometers", "hectares"]).default("square_meters")
          .describe("面积单位：square_meters(平方米)、square_kilometers(平方公里)或hectares(公顷)"),
        coordType: z.enum(["WGS84", "GCJ02", "BD09"]).default("WGS84").describe("输入坐标类型")
      },
      async ({ coordinates, unit, coordType }) => {
        try {
          // 如果不是WGS84坐标，先转换为WGS84
          let wgs84Coordinates = coordinates;
          if (coordType === "GCJ02") {
            wgs84Coordinates = coordinates.map(([lon, lat]) => this.GCJ02toWGS84(lon, lat));
          } else if (coordType === "BD09") {
            wgs84Coordinates = coordinates.map(([lon, lat]) => this.BD09toWGS84(lon, lat));
          }

          let area = this.calculatePolygonArea(wgs84Coordinates);
          
          // 单位转换
          switch (unit) {
            case "square_kilometers":
              area = area / 1000000; // 转换为平方公里
              break;
            case "hectares":
              area = area / 10000; // 转换为公顷
              break;
          }

          // 保留4位小数
          area = Math.round(area * 10000) / 10000;

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                area: area,
                unit: unit,
                coordinates: coordinates,
                coordType: coordType
              }, null, 2)
            }]
          };
        } catch (err) {
          return {
            content: [{
              type: "text",
              text: `错误: ${err.message}`
            }],
            isError: true
          };
        }
      }
    );
  }
}

module.exports = GeoServer; 