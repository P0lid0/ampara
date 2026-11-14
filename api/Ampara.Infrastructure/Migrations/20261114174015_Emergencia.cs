using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ampara.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Emergencia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TentativasEmergencia",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmailNormalizado = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    Em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Sucesso = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TentativasEmergencia", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TentativasEmergencia_EmailNormalizado_Em",
                table: "TentativasEmergencia",
                columns: new[] { "EmailNormalizado", "Em" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TentativasEmergencia");
        }
    }
}
