import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .pipe(z.email("Enter a valid email address"));

const passwordSchema = z
  .string()
  .min(1, "Password is required")
  .min(8, "Password must be at least 8 characters");

export const signInSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(3, "Display name must be at least 3 characters")
      .max(20, "Display name must be 20 characters or fewer"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .strict()
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;
