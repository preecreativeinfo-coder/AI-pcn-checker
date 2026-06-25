import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { UploadCloud, File, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useVehicles } from "@/hooks/use-vehicles";
import { useCreatePCN } from "@/hooks/use-pcns";
import { runOcr } from "@/lib/ocr";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const pcnFormSchema = z.object({
  pcn_reference: z.string().min(1, "Reference number is required"),
  issuer: z.string().min(1, "Issuer is required"),
  issue_date: z.string().optional().nullable(),
  amount: z.coerce.number().min(0, "Amount must be a positive number"),
  due_date: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  vehicle_id: z.string().optional().nullable(),
  status: z.enum(["pending", "paid", "contested"]).default("pending"),
});

type PCNFormValues = z.infer<typeof pcnFormSchema>;

export default function UploadPCNPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { session } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<"upload" | "processing" | "form">("upload");
  const [rawOcrText, setRawOcrText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: vehicles } = useVehicles();
  const createPCN = useCreatePCN();

  const form = useForm<PCNFormValues>({
    resolver: zodResolver(pcnFormSchema),
    defaultValues: {
      pcn_reference: "",
      issuer: "",
      issue_date: "",
      amount: 0,
      due_date: "",
      location: "",
      vehicle_id: "none",
      status: "pending",
    },
  });

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile) return;
    
    const validTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!validTypes.includes(selectedFile.type)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, or PDF file.",
      });
      return;
    }

    setFile(selectedFile);
    setStep("processing");

    try {
      // OCR runs entirely in the browser (Tesseract.js for images, pdf.js for PDFs).
      const result = await runOcr(selectedFile);

      // Pre-fill form
      form.reset({
        pcn_reference: result.pcnReference || "",
        issuer: result.issuer || "",
        issue_date: result.issueDate || "",
        amount: result.amount || 0,
        due_date: result.dueDate || "",
        location: result.location || "",
        vehicle_id: "none",
        status: "pending",
      });

      setRawOcrText(result.rawText || null);
      setStep("form");

      toast({
        title: "Processing complete",
        description: "Please verify the extracted details below.",
      });
    } catch (error) {
      console.error("OCR Error:", error);
      toast({
        variant: "destructive",
        title: "Failed to process notice",
        description: "We couldn't read the file automatically. You can enter the details manually.",
      });
      setStep("form"); // Let them fill it manually
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const onSubmit = async (values: PCNFormValues) => {
    if (!session?.user?.id) return;
    
    setIsSaving(true);
    try {
      let filePath = null;
      
      // 1. Upload file if exists
      if (file) {
        const timestamp = new Date().getTime();
        const extension = file.name.split('.').pop();
        const storagePath = `${session.user.id}/${timestamp}_pcn.${extension}`;
        
        const { error: uploadError } = await supabase.storage
          .from("pcn-files")
          .upload(storagePath, file);
          
        if (uploadError) {
          console.error("Upload error:", uploadError);
          // We'll continue without the file rather than failing completely
          toast({
            variant: "destructive",
            title: "File upload failed",
            description: "The notice was saved but the file attachment failed.",
          });
        } else {
          filePath = storagePath;
        }
      }
      
      // 2. Insert record
      await createPCN.mutateAsync({
        pcn_reference: values.pcn_reference,
        issuer: values.issuer,
        issue_date: values.issue_date || null,
        amount: values.amount,
        due_date: values.due_date || null,
        location: values.location || null,
        vehicle_id: values.vehicle_id === "none" ? null : values.vehicle_id,
        status: values.status,
        file_path: filePath,
        ocr_raw_text: rawOcrText,
      });
      
      toast({
        title: "Notice saved successfully",
        description: "The PCN has been added to your dashboard.",
      });
      
      setLocation("/pcns");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to save notice",
        description: error.message || "An error occurred.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/pcns">
            <Button variant="ghost" size="icon" className="shrink-0" data-testid="btn-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Upload Notice</h1>
            <p className="text-muted-foreground mt-1">Add a new penalty charge notice to track.</p>
          </div>
        </div>

        {step === "upload" && (
          <Card className="border-dashed border-2 bg-muted/10">
            <CardContent className="pt-6">
              <div 
                className={`flex flex-col items-center justify-center py-12 px-4 text-center rounded-lg transition-colors ${isDragging ? "bg-primary/5 border-primary" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <UploadCloud className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Drag and drop your notice</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  Upload a clear photo or PDF of your penalty charge notice. We'll automatically extract the details.
                </p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/jpeg,image/png,application/pdf" 
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                  data-testid="input-file"
                />
                <Button onClick={() => fileInputRef.current?.click()} data-testid="btn-select-file">
                  Select File
                </Button>
                <p className="text-xs text-muted-foreground mt-4">
                  Supported formats: JPG, PNG, PDF
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "processing" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
              <h3 className="text-lg font-semibold mb-2">Scanning Document</h3>
              <p className="text-muted-foreground">Extracting details from {file?.name}...</p>
            </CardContent>
          </Card>
        )}

        {step === "form" && (
          <div className="grid gap-6 md:grid-cols-[1fr_300px]">
            <Card className="order-2 md:order-1">
              <CardContent className="pt-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <File className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">Notice Details</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="pcn_reference"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>PCN Reference Number</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-reference" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="issuer"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Issuing Authority</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g. Transport for London" data-testid="input-issuer" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="issue_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Issue Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} value={field.value || ""} data-testid="input-issue-date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="due_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Payment Due Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} value={field.value || ""} data-testid="input-due-date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fine Amount (£)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" {...field} data-testid="input-amount" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <ResponsiveSelect
                                value={field.value}
                                onValueChange={field.onChange}
                                title="Status"
                                placeholder="Select status"
                                data-testid="select-status"
                                options={[
                                  { value: "pending", label: "Pending" },
                                  { value: "paid", label: "Paid" },
                                  { value: "contested", label: "Contested" },
                                ]}
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="Where was the notice issued?" data-testid="input-location" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="vehicle_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vehicle (Optional)</FormLabel>
                            <ResponsiveSelect
                              value={field.value || "none"}
                              onValueChange={field.onChange}
                              title="Vehicle"
                              placeholder="Select a vehicle"
                              data-testid="select-vehicle"
                              options={[
                                { value: "none", label: "No vehicle linked" },
                                ...(vehicles?.map((v) => ({
                                  value: v.id,
                                  label: `${v.registration_number} - ${v.make}`,
                                })) ?? []),
                              ]}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setStep("upload");
                          setFile(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSaving} data-testid="btn-save">
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Notice"
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <div className="order-1 md:order-2 space-y-4">
              <Alert className="bg-primary/5 border-primary/20">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertTitle>Extraction complete</AlertTitle>
                <AlertDescription className="text-xs">
                  We've populated the form with details found in your document. Please verify them before saving.
                </AlertDescription>
              </Alert>

              {file && (
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="bg-muted p-2 rounded">
                      <File className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
