import { useState, type CSSProperties, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const baseFieldStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  background: 'var(--atlas-paper)',
  boxShadow: 'inset 0 0 0 1px var(--atlas-line)',
  fontFamily: 'var(--atlas-sans)',
  fontSize: 13.5,
  color: 'var(--atlas-ink)',
  outline: 'none',
  border: 0,
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  transition: 'box-shadow 120ms ease'
};

const focusShadow = 'inset 0 0 0 1.5px var(--atlas-ink)';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function AtlasInput({ style, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      style={{
        ...baseFieldStyle,
        boxShadow: focused ? focusShadow : baseFieldStyle.boxShadow,
        ...style
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      {...rest}
    />
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function AtlasTextarea({ style, onFocus, onBlur, ...rest }: TextareaProps) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      cols={1}
      style={{
        ...baseFieldStyle,
        resize: 'none',
        minHeight: 70,
        display: 'block',
        boxShadow: focused ? focusShadow : baseFieldStyle.boxShadow,
        ...style
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      {...rest}
    />
  );
}
