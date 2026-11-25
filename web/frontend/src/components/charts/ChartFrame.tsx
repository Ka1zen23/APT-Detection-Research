import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { SourceNote } from "@/components/features/common";

export function ChartFrame({
  title,
  description,
  source,
  glossaryId,
  footnote,
  children,
}: {
  title: string;
  description: string;
  source: string;
  glossaryId?: string;
  footnote?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-[16px] font-medium leading-snug tracking-tight text-foreground">{title}</h3>
        {glossaryId && (
          <Link
            to={`/glossary#${glossaryId}`}
            className="text-[12px] font-medium text-primary underline underline-offset-4 hover:text-primary/80"
          >
            What is this?
          </Link>
        )}
      </div>
      <p className="mt-1.5 max-w-[64ch] text-[13px] leading-relaxed text-muted-foreground">
        {description}
      </p>
      <div className="mt-4 min-h-0 flex-1">{children}</div>
      {footnote && (
        <div className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{footnote}</div>
      )}
      <SourceNote source={source} className="mt-3" />
    </Card>
  );
}
