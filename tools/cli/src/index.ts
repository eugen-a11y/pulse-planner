#!/usr/bin/env node
import { Command } from "commander";
import { registerSignup } from "./commands/signup.js";
import { registerSignin } from "./commands/signin.js";

const program = new Command();
program.name("pulse-cli").description("Pulse Project Planner test harness").version("0.1.0");

registerSignup(program);
registerSignin(program);

program.parseAsync(process.argv).catch((e) => {
  console.error("error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
