import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Container,
  Image,
  Modal,
  Paper,
  Select,
  Table,
  TextInput,
  Textarea,
  createTheme
} from '@mantine/core';

export const apartmentOpsTheme = createTheme({
  defaultRadius: 'md',
  primaryColor: 'lake',
  primaryShade: { light: 7, dark: 5 },
  white: '#fffdfa',
  black: '#172026',
  fontFamily: "'Manrope', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  headings: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '2rem', lineHeight: '1.08' },
      h2: { fontSize: '1.25rem', lineHeight: '1.2' },
      h3: { fontSize: '1rem', lineHeight: '1.25' }
    }
  },
  spacing: {
    xs: '0.375rem',
    sm: '0.625rem',
    md: '0.875rem',
    lg: '1.25rem',
    xl: '1.75rem'
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px'
  },
  colors: {
    lake: ['#eef8f8', '#d9eeee', '#b9dfdf', '#91cbcb', '#69b4b5', '#469d9f', '#2f8588', '#226b6e', '#1b5658', '#153f42'],
    alpine: ['#f0faf4', '#d9f2e2', '#b8e6c9', '#8fd6a9', '#63c385', '#41aa68', '#318d55', '#287246', '#225b3a', '#1c4930'],
    swiss: ['#fff1f0', '#ffd8d5', '#ffb4ae', '#fb8981', '#ee6158', '#d9433b', '#bd3029', '#9d2722', '#7f231f', '#5f1d1a'],
    amber: ['#fff8e7', '#fcecc2', '#f6d98b', '#efc250', '#e3a91e', '#c88f0e', '#a9730a', '#875a0b', '#6d490d', '#56390c'],
    slate: ['#f7f8f7', '#ecefed', '#dce1df', '#c4cdca', '#9facaa', '#7d8e8b', '#63736f', '#4e5b58', '#3e4947', '#2d3634']
  },
  components: {
    Button: Button.extend({ defaultProps: { radius: 'md', size: 'sm', fw: 650 } }),
    Badge: Badge.extend({ defaultProps: { radius: 'xl', size: 'sm', variant: 'light' } }),
    Paper: Paper.extend({
      defaultProps: { radius: 'md', p: 'md', withBorder: true, shadow: 'none', bg: 'white' }
    }),
    Card: Card.extend({
      defaultProps: { radius: 'md', p: 'md', withBorder: true, shadow: 'none', bg: 'white' },
      styles: {
        root: {
          transition: 'border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease'
        }
      }
    }),
    Container: Container.extend({ defaultProps: { size: 'xl', px: 'md' } }),
    Modal: Modal.extend({
      defaultProps: {
        radius: 'lg',
        centered: true,
        overlayProps: { backgroundOpacity: 0.55, blur: 4 },
        transitionProps: { transition: 'pop', duration: 160 }
      }
    }),
    Image: Image.extend({ defaultProps: { radius: 'sm' } }),
    ActionIcon: ActionIcon.extend({ defaultProps: { radius: 'md' } }),
    TextInput: TextInput.extend({ defaultProps: { radius: 'md', size: 'sm' } }),
    Textarea: Textarea.extend({ defaultProps: { radius: 'md', size: 'sm', autosize: true, minRows: 1 } }),
    Select: Select.extend({ defaultProps: { radius: 'md', size: 'sm', comboboxProps: { shadow: 'md' } } }),
    Table: Table.extend({
      defaultProps: {
        horizontalSpacing: 'sm',
        verticalSpacing: 'xs',
        striped: false,
        highlightOnHover: true,
        withRowBorders: true,
        fz: 'sm'
      }
    })
  }
});
