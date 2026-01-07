import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarFooter,
    SidebarRail,
} from "@/components/ui/sidebar";
import { LayoutDashboard, TrendingUp, Home as HomeIcon, Shield, Settings, Lock, Bitcoin, Gem, ChevronsUpDown, CreditCard, FileText, BarChart3, Calculator, LineChart, Building, Landmark, Tag, PiggyBank } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const portfolioItems = [
    { titleKey: "nav.investments", url: "/stocks", icon: TrendingUp, key: "investments" },
    { titleKey: "nav.crypto", url: "/crypto", icon: Bitcoin, key: "crypto" },
    { titleKey: "nav.bonds", url: "/bonds", icon: FileText, key: "bonds" },
    { titleKey: "nav.realEstate", url: "/real-estate", icon: HomeIcon, key: "realEstate" },
    { titleKey: "nav.otherAssets", url: "/other-assets", icon: Gem, key: "otherAssets" },
];

export function AppSidebar() {
    const [location] = useLocation();
    const { user, lockMutation } = useAuth();
    const { t } = useTranslation('common');

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" className="h-14" asChild>
                            <a href="/">
                                <div className="flex aspect-square size-10 shrink-0 items-center justify-center rounded-lg overflow-hidden">
                                    <img src="/moony-icon.png" alt="Moony" className="size-10" />
                                </div>
                                <div className="grid flex-1 text-left text-base leading-tight group-data-[collapsible=icon]:hidden">
                                    <span className="truncate font-bold">{t('app.name')}</span>
                                    <span className="truncate text-xs text-muted-foreground">{t('app.tagline')}</span>
                                </div>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {/* Platform Section */}
                <SidebarGroup>
                    <SidebarGroupLabel>{t('nav.platform')}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip={t('nav.dashboard')} isActive={location === "/"}>
                                    <Link href="/">
                                        <LayoutDashboard />
                                        <span className="group-data-[collapsible=icon]:hidden">{t('nav.dashboard')}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Financial Services Section */}
                <SidebarGroup>
                    <SidebarGroupLabel>{t('nav.financialServices')}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip={t('nav.bankAccounts')} isActive={location === "/bank-accounts" || location.startsWith("/bank-accounts/")}>
                                    <Link href="/bank-accounts">
                                        <Landmark />
                                        <span className="group-data-[collapsible=icon]:hidden">{t('nav.bankAccounts')}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            {(user?.menuPreferences?.loans ?? true) && (
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild tooltip={t('nav.loans')} isActive={location === "/loans" || location.startsWith("/loans/")}>
                                        <Link href="/loans">
                                            <CreditCard />
                                            <span className="group-data-[collapsible=icon]:hidden">{t('nav.loans')}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            )}
                            {(user?.menuPreferences?.insurance ?? true) && (
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild tooltip={t('nav.insurance')} isActive={location === "/insurance" || location.startsWith("/insurance/")}>
                                        <Link href="/insurance">
                                            <Shield />
                                            <span className="group-data-[collapsible=icon]:hidden">{t('nav.insurance')}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Portfolio Section */}
                <SidebarGroup>
                    <SidebarGroupLabel>{t('nav.portfolio')}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {portfolioItems
                                .filter((item) => user?.menuPreferences?.[item.key as keyof typeof user.menuPreferences] ?? true)
                                .map((item) => (
                                    <SidebarMenuItem key={item.key}>
                                        <SidebarMenuButton asChild tooltip={t(item.titleKey)} isActive={location === item.url}>
                                            <Link href={item.url}>
                                                <item.icon />
                                                <span className="group-data-[collapsible=icon]:hidden">{t(item.titleKey)}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Reports Section */}
                <SidebarGroup>
                    <SidebarGroupLabel>{t('nav.reports')}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip={t('nav.budgeting')} isActive={location === "/reports/budgeting"}>
                                    <Link href="/reports/budgeting">
                                        <PiggyBank />
                                        <span className="group-data-[collapsible=icon]:hidden">{t('nav.budgeting')}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip={t('nav.projection')} isActive={location === "/reports/projection"}>
                                    <Link href="/reports/projection">
                                        <LineChart />
                                        <span className="group-data-[collapsible=icon]:hidden">{t('nav.projection')}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip={t('nav.stocksAnalysis')} isActive={location === "/reports/stocks-analysis"}>
                                    <Link href="/reports/stocks-analysis">
                                        <Tag />
                                        <span className="group-data-[collapsible=icon]:hidden">{t('nav.stocksAnalysis')}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Calculators Section */}
                <SidebarGroup>
                    <SidebarGroupLabel>{t('nav.calculators')}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip={t('nav.cashflowPlanning')} isActive={location === "/reports/cashflow"}>
                                    <Link href="/reports/cashflow">
                                        <BarChart3 />
                                        <span className="group-data-[collapsible=icon]:hidden">{t('nav.cashflowPlanning')}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip={t('nav.annuityCalculator')} isActive={location === "/calculators/annuity"}>
                                    <Link href="/calculators/annuity">
                                        <Calculator />
                                        <span className="group-data-[collapsible=icon]:hidden">{t('nav.annuityCalculator')}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip={t('nav.estateCalculator')} isActive={location === "/calculators/estate"}>
                                    <Link href="/calculators/estate">
                                        <Building />
                                        <span className="group-data-[collapsible=icon]:hidden">{t('nav.estateCalculator')}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton size="lg">
                                    <Avatar className="size-8 shrink-0 rounded-lg">
                                        <AvatarFallback className="rounded-lg text-xs">
                                            {user?.name?.charAt(0).toUpperCase()}{user?.surname?.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                                        <span className="truncate font-semibold">{user?.name} {user?.surname}</span>
                                        <span className="truncate text-xs text-muted-foreground">{user?.email || t('app.userAccount')}</span>
                                    </div>
                                    <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg" side="bottom" align="end" sideOffset={4}>
                                <DropdownMenuLabel className="p-0 font-normal">
                                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                        <Avatar className="h-8 w-8 rounded-lg">
                                            <AvatarFallback className="rounded-lg">{user?.name?.charAt(0).toUpperCase()}{user?.surname?.charAt(0).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="grid flex-1 text-left text-sm leading-tight">
                                            <span className="truncate font-semibold">{user?.name} {user?.surname}</span>
                                            <span className="truncate text-xs text-muted-foreground">{user?.email || t('app.userAccount')}</span>
                                        </div>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                    <DropdownMenuItem asChild>
                                        <Link href="/settings">
                                            <Settings className="mr-2 h-4 w-4" />
                                            {t('nav.settings')}
                                        </Link>
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => lockMutation.mutate()} disabled={lockMutation.isPending}>
                                    <Lock className="mr-2 h-4 w-4" />
                                    {t('nav.lockApp')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}

