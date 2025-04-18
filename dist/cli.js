#!/usr/bin/env node

const GeoServer = require('./server.js');
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");

async function main() {
    try {
        const server = new GeoServer({
            name: "GeoCalculator",
            version: "1.0.0"
        });
        
        const transport = new StdioServerTransport();
        await server.connect(transport);
        
        console.log('GeoCalculator MCP Server is running...');
    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
}

main(); 