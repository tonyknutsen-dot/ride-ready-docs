import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

const featureRequestSchema = z.object({
  feature_title: z.string().trim().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  feature_description: z.string().trim().min(10, "Please provide at least 10 characters").max(2000, "Description must be less than 2000 characters"),
  use_case: z.string().trim().max(1000, "Use case must be less than 1000 characters").optional(),
});

interface RequestFeatureDialogProps {
  trigger?: React.ReactNode;
}

export const RequestFeatureDialog = ({ trigger }: RequestFeatureDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    feature_title: "",
    feature_description: "",
    use_case: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validatedData = featureRequestSchema.parse(formData);
      setIsSubmitting(true);

      const { error } = await supabase.from("feature_requests").insert({
        user_id: user?.id,
        feature_title: validatedData.feature_title,
        feature_description: validatedData.feature_description,
        use_case: validatedData.use_case || null,
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Feature request submitted!",
        description: "Thank you for your feedback. We'll review your suggestion.",
      });

      setFormData({
        feature_title: "",
        feature_description: "",
        use_case: "",
      });
      setOpen(false);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast({
          title: "Error submitting request",
          description: "Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const defaultTrigger = (
    <DropdownMenuItem
      className="flex items-center cursor-pointer"
      onSelect={(e) => {
        e.preventDefault();
        setOpen(true);
      }}
    >
      <Lightbulb className="h-4 w-4 mr-2" />
      Request a Feature
    </DropdownMenuItem>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Request a Feature
          </DialogTitle>
          <DialogDescription>
            Have an idea to improve Showmen's Ride Ready? We'd love to hear it!
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feature_title">
              Feature Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="feature_title"
              placeholder="E.g., Export maintenance logs to Excel"
              value={formData.feature_title}
              onChange={(e) => handleInputChange("feature_title", e.target.value)}
              className={errors.feature_title ? "border-destructive" : ""}
              disabled={isSubmitting}
            />
            {errors.feature_title && (
              <p className="text-sm text-destructive">{errors.feature_title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feature_description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="feature_description"
              placeholder="Describe the feature you'd like to see..."
              value={formData.feature_description}
              onChange={(e) => handleInputChange("feature_description", e.target.value)}
              className={`min-h-[120px] ${errors.feature_description ? "border-destructive" : ""}`}
              disabled={isSubmitting}
            />
            {errors.feature_description && (
              <p className="text-sm text-destructive">{errors.feature_description}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="use_case">
              How would you use this? (optional)
            </Label>
            <Textarea
              id="use_case"
              placeholder="E.g., I need this for quarterly council inspections..."
              value={formData.use_case}
              onChange={(e) => handleInputChange("use_case", e.target.value)}
              className={`min-h-[80px] ${errors.use_case ? "border-destructive" : ""}`}
              disabled={isSubmitting}
            />
            {errors.use_case && (
              <p className="text-sm text-destructive">{errors.use_case}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};