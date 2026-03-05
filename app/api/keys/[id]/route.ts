import { NextResponse } from 'next/server'
export async function DELETE() { return NextResponse.json({ error: 'Auth required' }, { status: 401 }) }
