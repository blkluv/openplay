import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { lazy } from "react";

import Index from "./pages/Index";
import Messages from "./pages/Messages";
import Settings from "./pages/Settings";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";

// Video pages
const VideoHome = lazy(() => import("./pages/video/VideoHome"));
const VideoShorts = lazy(() => import("./pages/video/VideoShorts"));
const VideoSubscriptions = lazy(() => import("./pages/video/VideoSubscriptions"));
const VideoWatch = lazy(() => import("./pages/video/VideoWatch"));
const VideoUpload = lazy(() => import("./pages/video/VideoUpload"));
const VideoUploadShort = lazy(() => import("./pages/video/VideoUploadShort"));
const VideoChannel = lazy(() => import("./pages/video/VideoChannel"));
const VideoSearch = lazy(() => import("./pages/video/VideoSearch"));
const VideoPlaylist = lazy(() => import("./pages/video/VideoPlaylist"));

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<VideoHome />} />
        <Route path="/shorts" element={<VideoShorts />} />
        <Route path="/shorts/:videoId" element={<VideoShorts />} />
        <Route path="/subscriptions" element={<VideoSubscriptions />} />
        <Route path="/watch/:eventId" element={<VideoWatch />} />
        <Route path="/upload" element={<VideoUpload />} />
        <Route path="/upload/short" element={<VideoUploadShort />} />
        <Route path="/channel/:pubkey" element={<VideoChannel />} />
        <Route path="/search" element={<VideoSearch />} />
        <Route path="/playlist/:pubkey/:dTag" element={<VideoPlaylist />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/settings" element={<Settings />} />
        {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;