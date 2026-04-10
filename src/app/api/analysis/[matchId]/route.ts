export async function POST(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  return Response.json({ matchId, message: "not implemented" }, { status: 501 });
}
