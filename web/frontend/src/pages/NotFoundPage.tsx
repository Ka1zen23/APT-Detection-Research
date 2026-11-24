import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <FileQuestion className="size-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold text-foreground">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This route is not part of the research dashboard. Use the navigation or global search to find
        the required experiment or documentation page.
      </p>
      <Button asChild>
        <Link to="/">Return to overview</Link>
      </Button>
    </div>
  );
}
