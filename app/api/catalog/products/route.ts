import { NextResponse } from 'next/server';
import { listProducts } from '@/lib/productStore';

export async function GET() {
  const products = await listProducts({ activeOnly: true });
  return NextResponse.json({ products });
}
