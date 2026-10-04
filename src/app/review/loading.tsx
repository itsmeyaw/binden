import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.6fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Verified signup requests</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-muted-foreground">
          <Spinner /> Loading requests
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Signup request</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
