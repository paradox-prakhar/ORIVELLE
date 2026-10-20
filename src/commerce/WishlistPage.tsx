import { useCommerce } from './context';
import { EmptyState, ErrorNotice, ProductCard, ProductSkeletons } from './shared';
export function WishlistPage() {
  const {wishlist,loading,connectionError,user} = useCommerce();
  return <section className="c-page"><header className="c-page-heading"><span className="c-eyebrow">FOR ANOTHER MOMENT</span><div className="c-heading-row"><h1>Close to <em>heart.</em></h1><p>A little collection of things that feel like you.<br/>{user ? 'Saved to your Orivelle account.' : 'Saved to this browser. Sign in to keep them with your account.'}</p></div></header>{connectionError && <ErrorNotice>{connectionError}</ErrorNotice>}{loading ? <ProductSkeletons/> : wishlist.length ? <div className="c-product-grid">{wishlist.map((product,index) => <ProductCard product={product} key={product.id} index={index}/>)}</div> : <EmptyState title="Follow your heart.">Tap the heart on any piece to save it for a slower moment.</EmptyState>}</section>;
}
