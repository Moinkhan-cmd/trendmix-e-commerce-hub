import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { BadgeDollarSign, Boxes, FolderKanban, LayoutDashboard, LogOut, Users, Settings, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAdminAuth } from "@/admin/AdminAuthProvider";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
};

const navItems: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/products", label: "Products", icon: Boxes },
  { to: "/admin/categories", label: "Categories", icon: FolderKanban },
  { to: "/admin/orders", label: "Orders", icon: BadgeDollarSign },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/profile", label: "Profile", icon: UserCircle },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout() {
  const { user, signOutAdmin } = useAdminAuth();
  const navigate = useNavigate();

  const onSignOut = async () => {
    await signOutAdmin();
    navigate("/admin/login", { replace: true });
  };

  const logoUrl = `${import.meta.env.BASE_URL}logo.svg`;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="container h-14 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2 font-semibold">
            <img src={logoUrl} alt="TrendMix logo" className="h-6 w-6 rounded-full object-cover" />
            TrendMix Admin
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={onSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="rounded-lg border border-border p-3 h-fit">
            <div className="text-xs uppercase text-muted-foreground px-2 py-2">Admin Menu</div>
            <Separator className="my-2" />
            <nav className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end as boolean | undefined}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    ].join(" ")
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>

          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
