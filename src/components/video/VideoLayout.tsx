import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Home,
  Video,
  Upload,
  Search,
  Menu,
  Bell,
  User,
  MessageSquare,
  Users,
  Plus,
  Smartphone,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LoginArea } from '@/components/auth/LoginArea';
import { AccountSwitcher } from '@/components/auth/AccountSwitcher';
import { NotificationsSheet } from '@/components/NotificationsSheet';
import { hexToNpub } from '@/lib/nostrUtils';
import LoginDialog from '@/components/auth/LoginDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface VideoLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export function VideoLayout({ children, showSidebar = true }: VideoLayoutProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { user: currentUser } = useCurrentUser();
  const [showAddAccountDialog, setShowAddAccountDialog] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background backdrop-blur-sm w-full">
        <div className="container flex h-14 items-center gap-2 md:gap-4 px-2 md:px-4">
          {/* Mobile Menu Button */}
          {showSidebar && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9"
              onClick={() => setShowMobileMenu(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          <Link to="/" className="flex items-center gap-1.5 font-semibold flex-shrink-0">
            <Video className="h-5 w-5 md:h-6 md:w-6" />
            <span className="hidden sm:inline-block text-sm md:text-base">OpenPlay</span>
          </Link>

          <form onSubmit={handleSearch} className="flex-1 max-w-xs sm:max-w-md md:max-w-2xl mx-auto">
            <div className="relative">
              <Input
                type="search"
                placeholder="Search..."
                className="w-full pr-10 h-9 md:h-10 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="absolute right-0 top-0 h-9 w-9 md:h-10 md:w-10"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </form>

          <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 flex-shrink-0">
            {currentUser ? (
              <>
                {/* Create Dropdown */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <Plus className="h-4 w-4 md:h-5 md:w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to="/upload" className="flex items-center cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Video
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/upload/short" className="flex items-center cursor-pointer">
                        <Smartphone className="h-4 w-4 mr-2" />
                        Upload Short
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <NotificationsSheet>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Bell className="h-4 w-4 md:h-5 md:w-5" />
                  </Button>
                </NotificationsSheet>
                <div className="sm:ml-1 md:ml-2">
                  <AccountSwitcher onAddAccountClick={() => setShowAddAccountDialog(true)} />
                </div>
              </>
            ) : (
              <LoginArea />
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex w-full max-w-full">
        {/* Sidebar */}
        {showSidebar && (
          <aside className="hidden lg:block w-20 border-r bg-background sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto flex-shrink-0 self-start z-40">
            <nav className="flex flex-col gap-1 px-1 pt-0 pb-2">
              <Button variant="ghost" className="flex-col h-16 px-0 py-2" asChild>
                <Link to="/" className="flex flex-col items-center justify-center gap-1">
                  <Home className="h-6 w-6" />
                  <span className="text-[10px] leading-none">Home</span>
                </Link>
              </Button>
              <Button variant="ghost" className="flex-col h-16 px-0 py-2" asChild>
                <Link to="/shorts" className="flex flex-col items-center justify-center gap-1">
                  <Smartphone className="h-6 w-6" />
                  <span className="text-[10px] leading-none">Shorts</span>
                </Link>
              </Button>
              {currentUser && (
                <Button variant="ghost" className="flex-col h-16 px-0 py-2" asChild>
                  <Link to="/subscriptions" className="flex flex-col items-center justify-center gap-1">
                    <Users className="h-6 w-6" />
                    <span className="text-[10px] leading-none">Subscriptions</span>
                  </Link>
                </Button>
              )}
              {currentUser && (
                <Button variant="ghost" className="flex-col h-16 px-0 py-2" asChild>
                  <Link to="/messages" className="flex flex-col items-center justify-center gap-1">
                    <MessageSquare className="h-6 w-6" />
                    <span className="text-[10px] leading-none">Messages</span>
                  </Link>
                </Button>
              )}
              <div className="h-px bg-border my-1" />
              {currentUser && (
                <Button variant="ghost" className="flex-col h-16 px-0 py-2" asChild>
                  <Link to={`/channel/${hexToNpub(currentUser.pubkey)}`} className="flex flex-col items-center justify-center gap-1">
                    <User className="h-6 w-6" />
                    <span className="text-[10px] leading-none">Channel</span>
                  </Link>
                </Button>
              )}
            </nav>
          </aside>
        )}

        {/* Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>

      {/* Add Account Dialog */}
      {showAddAccountDialog && (
        <LoginDialog
          isOpen={showAddAccountDialog}
          onClose={() => setShowAddAccountDialog(false)}
          onLogin={() => setShowAddAccountDialog(false)}
        />
      )}

      {/* Mobile Navigation Menu */}
      {showSidebar && (
        <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
          <SheetContent side="left" className="w-48 p-0">
            <SheetHeader className="px-3 py-3 border-b">
              <SheetTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                <span className="text-base">OpenPlay</span>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-0.5 px-1 py-2">
              <Button
                variant="ghost"
                className="flex-col h-16 px-0 py-2"
                asChild
                onClick={() => setShowMobileMenu(false)}
              >
                <Link to="/" className="flex flex-col items-center justify-center gap-1">
                  <Home className="h-6 w-6" />
                  <span className="text-[10px] leading-none">Home</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="flex-col h-16 px-0 py-2"
                asChild
                onClick={() => setShowMobileMenu(false)}
              >
                <Link to="/shorts" className="flex flex-col items-center justify-center gap-1">
                  <Smartphone className="h-6 w-6" />
                  <span className="text-[10px] leading-none">Shorts</span>
                </Link>
              </Button>
              {currentUser && (
                <Button
                  variant="ghost"
                  className="flex-col h-16 px-0 py-2"
                  asChild
                  onClick={() => setShowMobileMenu(false)}
                >
                  <Link to="/subscriptions" className="flex flex-col items-center justify-center gap-1">
                    <Users className="h-6 w-6" />
                    <span className="text-[10px] leading-none">Subscriptions</span>
                  </Link>
                </Button>
              )}
              {currentUser && (
                <Button
                  variant="ghost"
                  className="flex-col h-16 px-0 py-2"
                  asChild
                  onClick={() => setShowMobileMenu(false)}
                >
                  <Link to="/messages" className="flex flex-col items-center justify-center gap-1">
                    <MessageSquare className="h-6 w-6" />
                    <span className="text-[10px] leading-none">Messages</span>
                  </Link>
                </Button>
              )}
              <div className="h-px bg-border my-1" />
              {currentUser && (
                <Button
                  variant="ghost"
                  className="flex-col h-16 px-0 py-2"
                  asChild
                  onClick={() => setShowMobileMenu(false)}
                >
                  <Link to={`/channel/${hexToNpub(currentUser.pubkey)}`} className="flex flex-col items-center justify-center gap-1">
                    <User className="h-6 w-6" />
                    <span className="text-[10px] leading-none">Channel</span>
                  </Link>
                </Button>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
