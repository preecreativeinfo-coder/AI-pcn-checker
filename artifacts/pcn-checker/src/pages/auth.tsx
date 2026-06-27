import { useState } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FileText, Check } from "lucide-react";
import { ACCOUNT_TYPE_OPTIONS, type AccountType } from "@/lib/account";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [orgName, setOrgName] = useState("");

  const form = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof authSchema>, mode: "signin" | "signup") => {
    setIsLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            // Recorded so AccountProvider can bootstrap the account on first login.
            data: {
              account_type: accountType,
              account_name:
                accountType === "personal" ? null : orgName.trim() || values.email,
            },
          },
        });
        if (error) throw error;
        toast({
          title: "Account created",
          description: "Welcome to PCN Checker. You are now logged in.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) throw error;
      }
      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Authentication failed",
        description: error.message || "An error occurred during authentication.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="bg-primary/10 p-3 rounded-full">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">PCN Checker</h1>
          <p className="text-sm text-muted-foreground">
            Manage your penalty charge notices with ease.
          </p>
        </div>

        <Card className="border-border shadow-sm">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-t-lg rounded-b-none border-b bg-muted/50 p-0 h-12">
              <TabsTrigger 
                value="signin" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-none rounded-none h-full data-[state=active]:border-b-2 data-[state=active]:border-primary"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger 
                value="signup" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-none rounded-none h-full data-[state=active]:border-b-2 data-[state=active]:border-primary"
              >
                Create Account
              </TabsTrigger>
            </TabsList>
            <CardContent className="p-6">
              <Form {...form}>
                <form className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="name@example.com" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} data-testid="input-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <TabsContent value="signin" className="m-0 pt-2">
                    <Button 
                      className="w-full" 
                      onClick={form.handleSubmit((v) => onSubmit(v, "signin"))}
                      disabled={isLoading}
                      data-testid="btn-signin"
                    >
                      {isLoading ? "Signing in..." : "Sign In"}
                    </Button>
                  </TabsContent>
                  
                  <TabsContent value="signup" className="m-0 space-y-4 pt-2">
                    {/* Account type selector */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Account type</p>
                      <div className="space-y-2">
                        {ACCOUNT_TYPE_OPTIONS.map((opt) => {
                          const active = accountType === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setAccountType(opt.value)}
                              className={`flex w-full select-none items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                                active ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                              }`}
                            >
                              <span
                                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                  active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                                }`}
                              >
                                {active && <Check className="h-3 w-3" />}
                              </span>
                              <span>
                                <span className="block text-sm font-medium">{opt.label}</span>
                                <span className="block text-xs text-muted-foreground">{opt.description}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {accountType !== "personal" && (
                      <div className="space-y-1.5">
                        <label htmlFor="org-name" className="text-sm font-medium">
                          {accountType === "business_agency" ? "Agency name" : "Business name"}
                        </label>
                        <Input
                          id="org-name"
                          placeholder={accountType === "business_agency" ? "e.g. Acme Parking Services" : "e.g. Acme Logistics Ltd"}
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                        />
                      </div>
                    )}

                    <Button
                      className="w-full"
                      onClick={form.handleSubmit((v) => onSubmit(v, "signup"))}
                      disabled={isLoading}
                      data-testid="btn-signup"
                    >
                      {isLoading ? "Creating account..." : "Create Account"}
                    </Button>
                  </TabsContent>
                </form>
              </Form>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
