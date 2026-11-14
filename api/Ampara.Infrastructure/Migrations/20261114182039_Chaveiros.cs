using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ampara.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Chaveiros : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Chaveiros",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Online = table.Column<bool>(type: "boolean", nullable: false),
                    Bateria = table.Column<int>(type: "integer", nullable: true),
                    BateriaBaixa = table.Column<bool>(type: "boolean", nullable: false),
                    VistoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PareadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Chaveiros", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Chaveiros_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Chaveiros_DeviceId",
                table: "Chaveiros",
                column: "DeviceId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Chaveiros_UsuarioId",
                table: "Chaveiros",
                column: "UsuarioId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Chaveiros");
        }
    }
}
