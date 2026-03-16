import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

describe('Sample Frontend Test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });

  it('can render a component', () => {
    render(<h1>Hello Testing</h1>);
    expect(screen.getByText('Hello Testing')).toBeInTheDocument();
  });
});
