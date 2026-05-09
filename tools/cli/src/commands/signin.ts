import type { Command } from "commander";
import { buildContext } from "../context.js";

export function registerSignin(program: Command): void {
  program
    .command("signin <email> <password>")
    .description("Sign in to Pulse")
    .action(async (email: string, password: string) => {
      const { auth } = buildContext();
      const session = await auth.signIn(email, password);
      console.log("Signed in as", session.user.email, session.user.id);
    });
}
