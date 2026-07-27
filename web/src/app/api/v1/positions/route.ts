import { NextRequest, NextResponse } from 'next/server';
import { readPositions } from '@/lib/contract';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user = searchParams.get('user');

  if (!user) {
    return NextResponse.json(
      { error: 'Missing required query parameter: user' },
      { status: 400 }
    );
  }

  try {
    const positions = await readPositions(user);
    return NextResponse.json(
      {
        user,
        total: positions.length,
        positions,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { user, total: 0, positions: [], note: 'Failed to fetch on-chain state or user has no open positions' },
      { status: 200 }
    );
  }
}
