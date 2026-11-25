import { InteractivePipeline } from "@/components/publication/InteractivePipeline";

export function PipelinePage() {
  return <>
    <p className="pub-kicker">Visual research lab · methodology</p>
    <h1 className="pub-editorial-title">From system records to an alert</h1>
    <p className="pub-lede">See exactly where graph context, text, embeddings and reconstruction error enter the detector. The examples explain the method; recorded research statistics are labelled separately.</p>
    <div className="pub-section-space"><InteractivePipeline /></div>
  </>;
}
