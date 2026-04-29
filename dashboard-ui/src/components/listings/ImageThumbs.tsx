import { Listing } from '../../api/schemas';
import { ListingImageGallery } from './ListingImageGallery';

export function ImageThumbs({
  item,
  onOpen
}: {
  item: Listing;
  onOpen: (urls: string[], index: number) => void;
}) {
  return <ListingImageGallery item={item} onOpen={onOpen} variant="table" />;
}
