#!/usr/bin/env node
/// <reference types="node" />
import { main } from "./cli";

process.exitCode = await main(process.argv.slice(2));
