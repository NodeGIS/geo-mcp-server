# @zealgeo/mcp-geo-server

这是一个基于 Model Context Protocol (MCP) 的地理处理工具服务器，提供坐标系统转换、距离计算、面积计算等空间分析功能。

## 安装

```json
"geo-mcp-server": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y"
        "@zealgeo/mcp-geo-server"
      ]
    }
```

## 功能

支持以下坐标系统之间的转换：
- BD09（百度坐标系）
- GCJ02（火星坐标系）
- WGS84（GPS坐标系）
- Web Mercator（网络墨卡托投影）

支持的转换方法：
- BD09 与 GCJ02 互转
- WGS84 与 GCJ02 互转
- BD09 与 WGS84 互转
- Web Mercator 与经纬度互转

支持的空间计算：
- 计算折线距离（支持米、千米单位）
- 计算多边形面积（支持平方米、平方公里、公顷单位）
- 支持多种坐标系统输入（WGS84、GCJ02、BD09）

## MCP Tools

### mcp_geo_convert
坐标系统转换工具。支持 BD09、GCJ02、WGS84 和 Web Mercator 之间的互相转换。

参数：
- `method`: 转换方法
  - `BD09toGCJ02`: 百度坐标系转火星坐标系
  - `GCJ02toBD09`: 火星坐标系转百度坐标系
  - `WGS84toGCJ02`: WGS84转火星坐标系
  - `GCJ02toWGS84`: 火星坐标系转WGS84
  - `BD09toWGS84`: 百度坐标系转WGS84
  - `WGS84toBD09`: WGS84转百度坐标系
  - `WebMercatortoLngLat`: Web墨卡托转经纬度
  - `LngLattoWebMercator`: 经纬度转Web墨卡托
- `longitude`: 经度值
- `latitude`: 纬度值

### mcp_geo_calculate_distance
计算折线距离。基于 Web Mercator 投影进行平面距离计算。

参数：
- `coordinates`: 折线坐标点数组 `[[lon1,lat1], [lon2,lat2],...]`
- `unit`: 长度单位（`meters`米[默认]、`kilometers`千米）
- `coordType`: 输入坐标类型（`WGS84`[默认]、`GCJ02`、`BD09`）

### mcp_geo_calculate_area
计算多边形面积。基于 Web Mercator 投影进行平面面积计算。

参数：
- `coordinates`: 多边形坐标点数组 `[[lon1,lat1], [lon2,lat2],...]`
- `unit`: 面积单位（`square_meters`平方米[默认]、`square_kilometers`平方公里、`hectares`公顷）
- `coordType`: 输入坐标类型（`WGS84`[默认]、`GCJ02`、`BD09`）

## 坐标系说明

### BD09（百度坐标系）
百度地图使用的坐标系统，在GCJ02基础上再次加密。

### GCJ02（火星坐标系）
中国国测局制定的地理信息系统坐标系统，是对WGS84进行加密后的坐标系。

### WGS84
GPS原始坐标系统，目前广泛使用的GPS全球卫星定位系统使用的坐标系统。

### Web Mercator
网页地图使用的投影坐标系统，将球面坐标转换为平面坐标。用于距离和面积计算时可以获得更准确的结果。

## 注意事项

1. 坐标转换精度与原始数据质量有关
2. 中国大陆以外的坐标，WGS84与GCJ02坐标系转换将直接返回原始坐标
3. Web Mercator坐标通常以米为单位
4. 距离和面积计算使用Web Mercator投影后的平面计算方法，适用于中小尺度的计算
5. 对于跨越大洲的超长距离或超大面积，建议使用球面计算方法
6. 多边形面积计算不需要手动闭合，程序会自动处理闭合
 