import type { Command } from "commander";
import { buildContext } from "../context.js";

export function registerSignup(program: Command): void {
  program
    .command("signup <email> <password>")
    .description("Create a new Pulse account")
    .action(async (email: string, password: string) => {
      const { auth } = buildContext();
      const session = await auth.signUp(email, password);
      console.log("Signed up as", session.user.email, session.user.id);
    });
}
